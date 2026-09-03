# Sylph — Product & Compliance

Living document. Update this file whenever AI, analytics, social, external services, UGC,
payments, subscriptions, marketplace, location, notifications, or new permissions are introduced.
Every PR that touches those areas should touch this file too.

Status: **Phase 1 not yet implemented.** This document describes the architecture Phase 1 will
follow and the guardrails all later phases must respect.

---

## 1. Product Principles

1. The wardrobe (structured data: items, outfits, wear history) is the persistent asset. AI and
   social features are layers on top of it, not the product itself.
2. The app must remain fully useful with AI providers turned off.
3. Closet data is private by default and stays private unless the user takes a separate,
   explicit action to share it.
4. Server-side authorization is the only thing that decides who can read what. The client is
   never trusted to enforce privacy.
5. "Search my closet before telling me to buy" — AI and discovery features default to helping
   users use what they own before suggesting acquisition.
6. We do not scrape, reverse-engineer, or automate third-party platforms (Depop, Vinted,
   Mercari, Poshmark, Instagram, Pinterest, TikTok, retailers, resale marketplaces). External
   product links are user-supplied and are never auto-populated from a scraped page.
7. No feature ships that we believe would block App Store publication. When "cool feature" and
   "App Store / privacy / legal risk" conflict, we stop and flag it rather than build around it.

## 2. Feature Roadmap

| Phase | Scope |
|---|---|
| 1 | Private digital closet, outfit builder, outfit diary, wear tracking, basic insights |
| 1.5 | AI-assisted clothing cataloging (photo → suggested metadata) |
| 2 | AI stylist over the user's own closet, "Style This Item", packing |
| 3 | Public profiles, outfit posts, follow/like/comment/save, discovery, **required moderation infrastructure** |
| 3.5 | Recreate With My Closet, outfit-photo closet matching |
| 4 | Shopping companion, closet cleanout, prepare-to-sell |
| 5 | Evaluate native resale marketplace (not committed) |

Nothing beyond Phase 1 is implemented yet. This doc's later sections describe forward-looking
architecture decisions made *now* so those phases don't require redesign — not features that
exist today.

## 3. Architecture Decisions

**Release strategy: iOS and Android are both first-class from day one.** We build and test both
platforms throughout development, not iOS-then-port-later. Apple App Store is the first public
release; Google Play follows immediately after, from the same codebase. No consumer web app is
built — the only public web surface is the minimal legal/account-deletion pages required by
Google Play policy (§9), served as static routes off the backend, not a web application.

**Mobile client:** Expo (React Native + TypeScript), built via EAS Build, submitted via EAS
Submit to both App Store Connect and Google Play Console. Rejected a website-in-a-webview
approach outright — RN renders native UIKit/SwiftUI- and native-Android-view-backed UI, not a
webview, so it satisfies both stores' "not simply a repackaged website" expectations. We use a
custom Expo dev client (`expo-dev-client`), not Expo Go, from the start of development — both
Sign in with Apple and Google Sign-In require native modules Expo Go doesn't include, so this
requirement exists regardless of platform.

**Why Expo/RN over Swift/SwiftUI for this product:** Phase 1 is CRUD + photo capture + native
navigation — nothing here needs SwiftUI. The user is TS/JS-fluent, and Expo has first-class,
actively maintained modules for every Phase 1–3 native need: `expo-image-picker` (backed by
`PHPickerViewController`, which does *not* require full photo-library permission),
`expo-camera`, `expo-apple-authentication`, `expo-secure-store` (Keychain), and later
`expo-notifications`. EAS Build produces a real signed `.ipa`; this is a standard, App
Store–accepted path used by many production apps. Revisit this decision only if a later phase
needs heavy on-device ML (e.g., real-time visual similarity, on-device pose/segmentation) that
can't be served by a backend call or a native module — at that point a native module or a
small native ML microservice is the fix, not a full rewrite.

**Backend:** Node.js + TypeScript, Fastify, Zod for request/response validation, Prisma ORM
against PostgreSQL. Postgres because the domain is fundamentally relational (items, outfits,
join tables, and — later — a social graph) and needs real foreign keys and transactions,
not a document store.

**Object storage:** S3-compatible bucket, **private by default**. All reads/writes go through
short-lived signed URLs issued by the backend after an authorization check. No object is ever
served from a public ACL. When public posts exist (Phase 3), a *separate* public-readable
prefix/CDN will host a copy/derivative of an image the user explicitly shared — private
originals are never exposed via a public URL.

**AI gateway:** All AI/vision calls go through a backend service behind a provider-abstraction
interface (`AIProvider`), never called directly from the client. No provider API key is ever
shipped in the mobile bundle. Not built in Phase 1; the abstraction boundary is a design
commitment for Phase 1.5, described in §10–11.

**Client/server boundary:** The mobile app never talks to Postgres or S3 directly. It talks to
one versioned REST API (`/v1/...`). All authorization, validation, and "what's public" decisions
live server-side.

**Authentication is provider-agnostic by design.** The backend models *who a person is*
(`User`) completely separately from *how they proved it* (`AuthIdentity`). No table, API
contract, or authorization check anywhere references "Apple" or "Google" — see §7.

## 4. Data Model (Phase 1)

Entities actually created in Phase 1's migrations:

```
User
  id, displayName, createdAt, updatedAt, deletedAt
  (deliberately has NO provider-specific fields — see AuthIdentity, and §7)

AuthIdentity
  id, userId (FK), provider (enum: APPLE, GOOGLE), providerUserId,
  email (nullable, as reported by the provider), emailVerified,
  createdAt, lastUsedAt, revokedAt
  unique (provider, providerUserId)
  (deliberately holds no provider refresh/access token — see §7 and §9)

Session
  id, userId, refreshTokenHash, deviceInfo, platform (ios|android — informational only,
  never used in authorization logic), createdAt, expiresAt, revokedAt

ClosetItem
  id, ownerId, name, category, subcategory, colors[], brand, pattern, material,
  season[], styleTags[], size, notes, favorite, visibility (enum, PRIVATE only used today),
  createdAt, updatedAt, deletedAt

ClosetItemImage
  id, closetItemId, storageKey, contentHash, width, height, isPrimary, createdAt

Outfit
  id, ownerId, name, notes, occasion, favorite, visibility (enum, PRIVATE only used today),
  createdAt, updatedAt, deletedAt

OutfitItem  (join table — Outfit does NOT copy ClosetItem data)
  outfitId, closetItemId, role (nullable, e.g. "top"/"bottom" — unused today, reserved so
  Recreate-With-My-Closet can later reason about "what role did this item play")

WearLog
  id, ownerId, outfitId (nullable — an outfit can later be deleted),
  wornDate, notes, itemSnapshot (JSON: [{closetItemId, name, thumbnailKey}] captured at
  log time), createdAt
```

Notes on decisions that look small but matter:

- **`User` has no provider-specific column, and `AuthIdentity` is its own table**, so a person
  can eventually hold both an `APPLE` and a `GOOGLE` identity pointing at one `User` without a
  schema change. We deliberately do **not** auto-link identities by matching email across
  providers — email equality isn't proof of same-person (Apple's private relay email in
  particular won't match a real Gmail address), and auto-linking is an account-takeover vector.
  Cross-provider linking, when it ships, is an explicit action taken by an already-authenticated
  user.
- **`Outfit` never duplicates `ClosetItem` fields** — it only references items via `OutfitItem`.
  This is required by the spec and also the only sane way to keep "edit item once, reflected
  everywhere" behavior.
- **`WearLog.itemSnapshot` is denormalized on purpose.** If a user later deletes a closet item or
  edits an outfit, past diary entries must still show what was actually worn that day. Wear
  history is never retroactively rewritten.
- **`visibility` enum exists now with a single usable value (`PRIVATE`)** so that Phase 3 can add
  `PUBLIC` without a breaking migration — but nothing in Phase 1's UI or API lets a user set
  anything other than `PRIVATE`. This is the one "designed for later" field we add pre-emptively,
  because retrofitting a visibility column onto millions of rows later is the kind of migration
  worth avoiding; everything else in this document that is "for later" is a *document*, not a
  column.
- **`ClosetItemImage.contentHash`** (e.g. SHA-256 of the resized upload) exists so Phase 1.5 AI
  analysis can key its cache on "have we analyzed this exact image before" without re-running
  inference on unchanged photos. Adding the column now avoids a backfill later; it is unused by
  any AI code in Phase 1.
- **No `Post`, `Follow`, `Like`, `Comment`, `Save`, `Report`, or `Block` tables exist yet.** These
  are described conceptually in §14 for Phase 3 design continuity, but are intentionally not
  migrated — per the spec's instruction not to prematurely implement future complexity.

## 5. Private vs. Public Data Model

There is no public data in Phase 1. The separation this section commits to, for Phase 3:

- A `Post` will reference an `Outfit` by ID. It will **not** inherit visibility from the
  underlying `Outfit`/`ClosetItem` records — a post becomes public only via its own explicit
  publish action.
- The API will never serialize a `ClosetItem` or `Outfit` record directly into a public
  response. Public responses use a distinct, intentionally-thin public projection (e.g.
  `PublicTaggedItem { label, category, imageUrl?, sourceType }`) assembled server-side.
  A private field being absent from that projection type is a compile-time guarantee, not a
  "remember to strip it" runtime hope.
- Authorization checks (`ownerId === session.userId`) happen in the service layer, before any
  data reaches a response serializer — never inferred from "is this route under `/public/`."
- Tests are written *around this boundary specifically* (see §9 and the testing strategy below):
  cross-user reads of private closet/outfit/image data must fail at the API layer regardless of
  what the client requests or renders.

## 6. Permissions & Justification

| Permission | Platform | When requested | Why |
|---|---|---|---|
| Photo Library (limited/picker) | iOS | User taps "choose from library" | `expo-image-picker` uses `PHPickerViewController`, which does not require the OS "access all photos" grant — the system picker runs out-of-process and only the selected photo is handed to the app. `NSPhotoLibraryUsageDescription` is still declared but no broad-library-access prompt is shown. |
| Photo access | Android | User taps "choose from library" | On Android 13+ (API 33+), `expo-image-picker` uses the system Photo Picker (`ACTION_PICK_IMAGES`), which is likewise permissionless — the picker runs out-of-process and only the selected photo is handed to the app. On Android 12 and below it falls back to a runtime `READ_EXTERNAL_STORAGE`/`READ_MEDIA_IMAGES` permission request, requested lazily at the same moment. |
| Camera | iOS + Android | User taps "take photo" | Requested lazily, only at the moment of use, never at app launch, on both platforms. |
| (Future) Push notifications | iOS + Android | Not requested in Phase 1 | Deferred until there is a feature that needs it (e.g. social interactions in Phase 3). Note Android 13+ also gates notifications behind a runtime permission (`POST_NOTIFICATIONS`), same lazy-request pattern will apply. |
| (Future) Location | iOS + Android | Not requested in Phase 1 | Deferred; would only support optional "occasion/trip" context, never required. |

No permission is requested at first launch "just in case," on either platform. Denial of any
permission must degrade gracefully (e.g., manual item entry remains fully available with no
photo) on both platforms.

## 7. Authentication Decisions

**Provider-agnostic core.** `User` never references a provider; `AuthIdentity` does (§4). Every
downstream authorization check operates on `session.userId` only — nothing in the API,
middleware, or business logic ever branches on which provider a user signed in with. This is
what lets us add providers (or let one person link both Apple and Google) without touching
authorization code.

**Phase 1 providers:**
- **Sign in with Apple — iOS only**, shown only in the iOS build's sign-in screen (Android
  can't use it; Apple doesn't expect it there). Per current App Store Guideline 4.8, Sign in
  with Apple isn't unconditionally mandatory, but it trivially satisfies it (supports "Hide My
  Email," no ad tracking) so there's no reason not to offer it on iOS.
- **Sign in with Google — iOS and Android**, via `@react-native-google-signin/google-signin`
  (the current Expo-recommended, actively maintained library; requires a custom dev client, not
  Expo Go — already a project baseline per §3).

**We deliberately do not retain provider refresh/access tokens.** Both providers are used purely
for identity verification, not for any ongoing access to Apple/Google APIs on the user's behalf:

- Apple: backend verifies the native SDK's `identityToken` (a signed JWT) against Apple's public
  keys (`aud` = our bundle/service ID, `iss` = `https://appleid.apple.com`). No authorization-code
  exchange, no Apple private-key/client-secret JWT signing, no stored Apple token.
- Google: backend verifies the SDK's `idToken` the same way, against Google's public keys
  (`aud` = our Google OAuth client ID). No server auth code requested, no Google client secret,
  no stored Google token.
- Both flows converge on one internal `findOrCreateUser(provider, providerUserId, email)`
  function that returns a `User` and issues a Sylph session — no provider-specific branching
  past this point.
- The app never trusts a client-asserted user id from either provider; the backend is the only
  source of truth for "who is this."
- **Why this is safe to skip:** Apple's own technote on this
  ([TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple))
  documents an explicit fallback for apps that don't hold a revocable token: delete the
  account's data and direct the user to revoke access themselves in their provider account
  settings. Getting a revocable token at all requires the authorization-code exchange this
  design skips; since a real, documented fallback exists, we're not trading away a hard
  requirement — we're avoiding holding a category of long-lived credential (OAuth refresh
  tokens to a third party) we don't otherwise need, per the instruction to minimize sensitive
  credential storage. See §9 for how this plays out at deletion time.

**Sessions (unchanged by platform):** short-lived JWT access token (~15 min) + rotating refresh
token. Refresh tokens are stored **hashed** server-side (`Session.refreshTokenHash`), so a DB
read alone can't be used to mint sessions. Client stores tokens via `expo-secure-store`, which is
backed by Keychain on iOS and Android Keystore-encrypted `EncryptedSharedPreferences` on Android
— never `AsyncStorage`/plain storage on either platform.

- Logout revokes the current session's refresh token server-side. "Log out of all devices"
  revokes all of the user's sessions, regardless of which provider(s) they signed in with.
- Rate limiting on `/v1/auth/*` (IP + account-scoped) to blunt credential/token abuse, applied
  identically to both provider endpoints.

## 8. User-Data Lifecycle

- Created: on first sign-in via any linked provider (Apple or Google — see §7).
- Updated: user-driven edits only (no silent server-side mutation of wardrobe data — including
  by future AI features, which only ever *suggest*, per §11).
- No provider refresh/access tokens are retained at all (§7) — there is nothing of that kind to
  protect, log-scrub, or rotate.
- Images: uploaded via a two-step signed-URL flow (client requests an upload slot, uploads
  directly to S3, then confirms) so raw bytes never transit the app server as a proxy payload.
  Images are resized/compressed client-side before upload; unnecessary EXIF metadata (GPS in
  particular) is stripped before upload.
- Deleted item still referenced by an outfit: removed from the `OutfitItem` join automatically;
  the outfit itself is untouched otherwise. Past `WearLog` entries are unaffected because they
  hold a snapshot, not a live reference.

## 9. Account Deletion

In-app account deletion is part of Phase 1, not a later add-on. Apple requires it in-app
(Guideline 5.1.1(v)). **Google Play requires both an in-app path and a web-reachable link where
deletion can be requested without installing/opening the app** — a real difference between the
two stores' policies, confirmed against Play's current account-deletion requirements. We
therefore ship both:

- **In-app deletion** (both platforms): the flow described below, initiated from Settings.
- **Web deletion-request page** (Play requirement, doesn't exist on Apple's side but we publish
  it regardless since one implementation serves both stores' listings): a minimal static page —
  `/legal/privacy` and `/legal/delete-account` — served as plain routes off the backend, not a
  separate web app. This is the one piece of public web surface in the project, and it exists
  solely to satisfy this policy — not a step toward a consumer web app. **Identity verification
  for the web flow is not designed yet** — we have no email/password auth to lean on, so
  "email verification" cannot be assumed. This gets designed explicitly in Step 8, when the page
  is actually built (options include a one-time link emailed to the address on an `AuthIdentity`
  the account has, or another mechanism chosen at that time); until then this row in the roadmap
  stays a placeholder, not an assumption.

On delete (in-app; the web flow in Step 8 will trigger the same backend code path):
1. All active sessions/refresh tokens revoked immediately.
2. **No provider-side revocation call is made** — by design, we hold no Apple/Google refresh or
   access token to revoke with (§7). Instead, the deletion confirmation UI tells the user their
   Sylph data is deleted and, if they also want to sever Sylph's access on the provider's side,
   points them to Apple ID → Sign-In & Security → Apps Using Apple ID, and/or
   myaccount.google.com/permissions. This mirrors Apple's own documented no-token fallback in
   TN3194 (§7) rather than working around it, and applies identically regardless of provider —
   no provider-specific branching.
3. `ClosetItem`, `ClosetItemImage`, `Outfit`, `OutfitItem`, `WearLog` rows for that user are
   hard-deleted; associated S3 objects are deleted via an async job (bounded SLA, e.g. ≤30 days,
   surfaced to the user as "your data is fully removed within 30 days" — satisfies both stores'
   expectation that deletion isn't merely deactivation).
4. `User` row itself: either hard-deleted or reduced to a minimal tombstone (hashed id only), to
   be decided once Phase 3 exists — a tombstone becomes relevant for abuse prevention (e.g.
   ban-evasion via delete-and-recreate) once there's UGC/moderation to evade. Not needed for
   Phase 1's no-UGC scope; default to hard delete until then.
5. Nothing is retained "for legitimate security/legal reasons" in Phase 1 — there is no
   transaction, payment, or report history yet that would create such a reason. Revisit this
   list explicitly before Phase 3 (moderation records of a deleted user's reported content may
   need bounded retention) and before any payments phase.

## 10. AI Providers

None integrated yet (Phase 1.5+). Architecture commitment made now:

- A single backend-internal `AIProvider` interface (e.g. `analyzeClothingImage(image) →
  { suggestions, confidence, provider, model }`) abstracts the concrete vendor, so switching or
  multi-sourcing providers later doesn't touch call sites.
- The mobile app never holds a provider API key and never calls a provider directly.
- Per-user request quotas and a request budget live server-side, in front of the provider call.
- Results are cached keyed by `ClosetItemImage.contentHash` so an unchanged image is never
  re-analyzed.

## 11. AI Data Flows

Not active in Phase 1. Committed policy for when Phase 1.5 lands:

- Sending a wardrobe photo to a third-party AI/vision provider requires an explicit,
  disclosed consent step before the first such call — not buried in a general ToS.
- Only the minimum image needed for the analysis is sent (resized, not the original if the
  original is larger than needed).
- Provider output is always stored and surfaced as a **suggestion** with a confidence/provenance
  field; it becomes authoritative `ClosetItem` data only after the user reviews/accepts it. AI
  never silently writes to the wardrobe.
- Brand identification is only ever suggested when the model itself reports sufficient
  confidence — never guessed to fill the field.
- Wardrobe images are never used for advertising, model training, or profiling beyond the
  specific analysis the user triggered, without separate explicit authorization.
- This section must be updated with the specific provider(s) chosen, their data-retention
  terms, and the exact consent copy, before Phase 1.5 ships.

## 12. Third-Party Integrations

None in Phase 1 beyond Apple (Sign in with Apple, identity verification only — no ongoing API
access, §7), Google (Sign in with Google, same scope), and our own S3-compatible storage/AI
infrastructure. No integration with Depop, Vinted, Mercari, Poshmark, Instagram, Pinterest,
TikTok, or retailer sites — no scraping, no undocumented/private API use, no automation against
those platforms, in any phase, unless a documented, authorized integration exists.

## 13. External Links

Not present in Phase 1 (no product/source URLs until tagged clothing exists in Phase 3). Policy
committed now for that phase: URLs are always user-supplied, never auto-populated by scraping the
linked page. Server-side validation before storage: enforced `http`/`https` scheme only (reject
`javascript:`, `data:`, `file:`, etc.), well-formed URL, length cap. Client renders external links
via the system browser/`SFSafariViewController`-style handoff, never loading third-party content
in an in-app WebView with app privileges. Redirect/phishing/spam handling is a moderation-system
concern (§14), addressed before public posting ships, not after.

## 14. UGC / Moderation Requirements

No UGC exists in Phase 1 (closet/outfit data is private, single-user). This section is the
binding design constraint for Phase 3, which **must not ship public posting or comments without
all of the following already in place**. We design to Apple's App Store Guideline 1.2, which is
the stricter and more specific of the two stores' UGC requirements (explicit ≤2-tap reporting,
blocking, filtering, published contact info); Google Play's User-Generated Content policy asks
for the same substantive protections (reporting, blocking, enforcement against violators) with
less procedural specificity, so meeting Apple's bar satisfies both:

- In-app reporting for posts, comments, and users, reachable in ≤2 taps from the content.
- A defined moderation workflow with a target SLA for acting on reports (Apple's review has
  cited 24 hours as an expectation for acting on reported content).
- User blocking that actually prevents the blocked user's content/interactions from reaching the
  blocker.
- An objectionable-content filter on images and text (at minimum an automated pre-filter; human
  review path for appeals/edge cases).
- Content deletion tooling for moderators/support.
- Published in-app support/contact mechanism.
- Rate limiting and spam/abuse protection on posting, commenting, and reporting endpoints.
- Published community guidelines.

"Add moderation later" is explicitly not an acceptable sequencing — moderation ships in the same
release as public posting/comments, not after.

## 15. Security-Sensitive Functionality

- All authorization is server-side; the client is never the enforcement point.
- Refresh tokens stored hashed; access tokens short-lived.
- Signed, time-limited URLs for all object storage reads/writes; no public bucket ACLs.
- Input validation (Zod schemas) on every API boundary; rejects malformed payloads before they
  reach business logic.
- Rate limiting on auth, upload, and (later) posting/reporting endpoints.
- No secrets (AI keys, storage credentials, signing keys) ever shipped in the mobile bundle;
  environment variables validated at backend boot (fail fast on missing/malformed config).
- No provider refresh/access tokens are stored server-side at all (§7) — Apple/Google are used
  strictly for identity verification, minimizing the credentials we hold.

## 16. App Store- and Play Store-Sensitive Functionality

- Account creation → in-app account deletion (§9) is present from v1.0 on both platforms, not
  added reactively after a rejection. Google Play's additional web-deletion-link requirement
  (§9) ships in the same release.
- Sign in with Apple (iOS) and Sign in with Google (iOS + Android) per §7 — no platform ships
  without a working native sign-in path.
- Camera/photo permissions requested contextually with clear usage strings on both platforms
  (§6), including Android's runtime permission model for API 32 and below.
- No UGC/public posting ships without the §14 moderation set, on either store.
- Apple's App Privacy "nutrition label" (App Store Connect) and Google Play's Data Safety form
  are both completed and kept in sync with actual data collection — they ask overlapping but
  not identical questions, so neither is a substitute for the other.
- No payments/subscriptions/marketplace exist yet; if/when they do, both Apple's and Google
  Play's in-app purchase/billing rules govern any digital good, and physical-goods marketplace
  transactions need a separate legal/payments review before implementation (§18).

## 17. Features Intentionally Prohibited (for now)

- Scraping or automating Depop, Vinted, Mercari, Poshmark, Instagram, Pinterest, TikTok, or any
  retailer/resale site.
- Auto-populating product metadata from a user-supplied external URL by fetching/parsing that
  page.
- Any use of undocumented/private third-party APIs.
- Public posting, comments, follows, likes, or any public-facing UGC surface before the §14
  moderation set exists.
- Payments, subscriptions, or marketplace functionality of any kind.
- Retailer scraping to power the shopping companion (Phase 4) — it operates only on
  user-photographed/user-entered items compared against the user's own wardrobe.
- Auto-posting to third-party marketplaces.

## 18. Pre-Release App Store Checklist

Not applicable until a release is imminent; kept here so it isn't invented from scratch later.

**Apple App Store**
- [ ] Privacy manifest / `PrivacyInfo.xcprivacy` present and accurate for all SDKs used (Expo
      modules, Google Sign-In SDK, any analytics later added).
- [ ] App Privacy "nutrition label" in App Store Connect matches actual data collection.
- [ ] Sign in with Apple tested end-to-end, including "Hide My Email."
- [ ] Account deletion tested end-to-end, including the in-app manual-revocation guidance (§9).
- [ ] `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` accurate and specific.
- [ ] No broad photo-library access requested where the picker suffices.

**Google Play**
- [ ] Data Safety form in Play Console matches actual data collection.
- [ ] Account deletion tested end-to-end on Android, including the in-app manual-revocation
      guidance (§9).
- [ ] Web-reachable account/data-deletion request page live, with its identity-verification
      mechanism (designed in Step 8, §9) actually working, and linked from the Play Store
      listing's Data Safety section.
- [ ] Android runtime permissions (camera; storage/media on API ≤32) request correctly and
      degrade gracefully on denial.
- [ ] Target API level meets Play's current minimum requirement at submission time.
- [ ] Google Sign-In tested end-to-end on both iOS and Android builds.

**Both platforms**
- [ ] All object storage access goes through signed URLs; no public bucket objects reachable by
      guessing a key.
- [ ] Cross-user authorization tests passing, and passing identically regardless of which
      provider(s) the test account signed in with (§7 boundary — no provider-specific authz
      branches to audit).
- [ ] No third-party AI/API keys present in the compiled client bundle.
- [ ] Support contact / feedback mechanism reachable in-app.
- [ ] If UGC/public posting is included in this release: full §14 moderation set verified
      end-to-end on both platforms, community guidelines published, report SLA process staffed.
- [ ] Terms of Service and Privacy Policy published and linked in-app, in App Store Connect
      metadata, and in the Play Console listing.
- [ ] This document reviewed and updated to match what's actually shipping.

---

*Last updated: 2026-09-03 — revised for dual iOS + Android release strategy and
provider-agnostic authentication, pre-Phase-1-implementation.*
