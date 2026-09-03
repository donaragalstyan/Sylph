import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { env } from "../env.js";

export const APPLE_ISSUER = "https://appleid.apple.com";
const defaultAppleJwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

export interface VerifiedAppleIdentity {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
}

export class InvalidAppleIdentityTokenError extends Error {}

/**
 * Thrown specifically for a nonce mismatch/absence, distinct from a bad signature/audience/
 * expiry. Still an InvalidAppleIdentityTokenError, so callers that only care "was this token
 * rejected" don't need to special-case it.
 */
export class InvalidAppleNonceError extends InvalidAppleIdentityTokenError {}

/** SHA-256 hex digest, matching the hashing CryptoKit/`ASAuthorizationAppleIDRequest` performs
 * on the client — see verifyAppleIdentityToken for the full flow. */
export function hashAppleNonce(rawNonce: string): string {
  return createHash("sha256").update(rawNonce, "utf8").digest("hex");
}

/**
 * Verifies a Sign in with Apple `identityToken` (a signed JWT from the native SDK) against
 * Apple's published JWKS, and validates the request nonce per Apple's Sign in with Apple
 * guidance. This is identity verification only — no authorization-code exchange, no Apple
 * refresh token is requested or stored. See docs/PRODUCT_AND_COMPLIANCE.md §7.
 *
 * Expected client flow (native, via `expo-apple-authentication`): generate a cryptographically
 * random `rawNonce` for this attempt, SHA-256-hash it, and pass the hash as the `nonce` option
 * to `AppleAuthentication.signInAsync()`. Apple embeds that same hash, verbatim, as the `nonce`
 * claim inside the returned `identityToken`. The client then sends both `identityToken` and the
 * original `rawNonce` (never the hash) here; we recompute the hash and require it to match the
 * token's `nonce` claim exactly. Because we always request a nonce, a token with no `nonce`
 * claim at all is rejected too — not treated as "nonce optional".
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  rawNonce: string,
  jwks: JWTVerifyGetKey = defaultAppleJwks,
): Promise<VerifiedAppleIdentity> {
  let payload;
  try {
    ({ payload } = await jwtVerify(identityToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: env.APPLE_AUDIENCE,
    }));
  } catch {
    throw new InvalidAppleIdentityTokenError("Invalid or expired Apple identity token");
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new InvalidAppleIdentityTokenError("Missing subject claim");
  }

  const expectedNonceHash = hashAppleNonce(rawNonce);
  if (payload["nonce"] !== expectedNonceHash) {
    throw new InvalidAppleNonceError("Nonce did not match this authentication attempt");
  }

  const email = typeof payload["email"] === "string" ? payload["email"] : null;
  const emailVerifiedClaim = payload["email_verified"];
  const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";

  return { providerUserId: payload.sub, email, emailVerified };
}
