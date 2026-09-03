import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

// Route-level tests exercise the full HTTP -> findOrCreateUser -> session flow. The provider
// verification functions are mocked here (unit-tested for real against local JWTs in
// auth.apple.test.ts / auth.google.test.ts) so these tests don't depend on network access to
// Apple/Google and can freely control what identity "comes back" from a token.
vi.mock("../src/auth/apple.js", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/apple.js")>(
    "../src/auth/apple.js",
  );
  return {
    ...actual,
    verifyAppleIdentityToken: vi.fn(async (token: string, _rawNonce: string) => {
      if (token === "invalid") throw new actual.InvalidAppleIdentityTokenError("bad token");
      return JSON.parse(token);
    }),
  };
});

vi.mock("../src/auth/google.js", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/google.js")>(
    "../src/auth/google.js",
  );
  return {
    ...actual,
    verifyGoogleIdToken: vi.fn(async (token: string) => {
      if (token === "invalid") throw new actual.InvalidGoogleIdentityTokenError("bad token");
      return JSON.parse(token);
    }),
  };
});

const { buildApp } = await import("../src/app.js");

// Route-level tests mock verifyAppleIdentityToken entirely, so the exact nonce value is
// irrelevant here — it only needs to satisfy the route's zod schema (min length 16). Real
// nonce hashing/matching is covered against the unmocked function in auth.apple.test.ts.
const TEST_RAW_NONCE = "test-raw-nonce-0123456789abcdef";

function appleToken(providerUserId: string, email: string | null = null) {
  return JSON.stringify({ providerUserId, email, emailVerified: !!email });
}

function googleToken(providerUserId: string, email: string | null = null) {
  return JSON.stringify({ providerUserId, email, emailVerified: !!email });
}

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp();
});

describe("auth flow", () => {
  it("creates a user and identity on first Apple sign-in", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: {
        identityToken: appleToken("apple-1", "a@example.com"),
        rawNonce: TEST_RAW_NONCE,
        displayName: "Dana",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.displayName).toBe("Dana");
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeTypeOf("string");
  });

  it("returns the same user on repeat sign-in with the same provider identity", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-2", "b@example.com"), rawNonce: TEST_RAW_NONCE },
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-2", "b@example.com"), rawNonce: TEST_RAW_NONCE },
    });

    expect(first.json().user.id).toBe(second.json().user.id);
  });

  it("does not merge an Apple identity and a Google identity that share an email", async () => {
    const shared = "shared@example.com";
    const apple = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-3", shared), rawNonce: TEST_RAW_NONCE },
    });
    const google = await app.inject({
      method: "POST",
      url: "/v1/auth/google",
      payload: { idToken: googleToken("google-3", shared) },
    });

    expect(apple.json().user.id).not.toBe(google.json().user.id);
  });

  it("rejects an invalid identity token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: "invalid", rawNonce: TEST_RAW_NONCE },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an Apple sign-in with a missing or too-short rawNonce", async () => {
    const missing = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-nonce-1", "n1@example.com") },
    });
    expect(missing.statusCode).toBe(400);

    const tooShort = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-nonce-2", "n2@example.com"), rawNonce: "short" },
    });
    expect(tooShort.statusCode).toBe(400);
  });

  it("GET /v1/me requires a valid access token", async () => {
    const noAuth = await app.inject({ method: "GET", url: "/v1/me" });
    expect(noAuth.statusCode).toBe(401);

    const badAuth = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: "Bearer garbage" },
    });
    expect(badAuth.statusCode).toBe(401);
  });

  it("GET /v1/me returns the caller's profile and linked identities", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: {
        identityToken: appleToken("apple-4", "d@example.com"),
        rawNonce: TEST_RAW_NONCE,
        displayName: "Riley",
      },
    });
    const { accessToken } = signIn.json();

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.displayName).toBe("Riley");
    expect(body.identities).toEqual([{ provider: "APPLE", createdAt: expect.any(String) }]);
  });

  it("GET /v1/me works identically for a Google-authenticated session", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/v1/auth/google",
      payload: { idToken: googleToken("google-7", "g@example.com"), displayName: "Sam" },
    });
    const { accessToken } = signIn.json();

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.displayName).toBe("Sam");
    expect(body.identities).toEqual([{ provider: "GOOGLE", createdAt: expect.any(String) }]);
  });

  it("rotates the refresh token and invalidates the previous one", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-5", "e@example.com"), rawNonce: TEST_RAW_NONCE },
    });
    const { refreshToken } = signIn.json();

    const rotated = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.json().refreshToken).not.toBe(refreshToken);

    const reuse = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it("rejects an unknown refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: "not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: { identityToken: appleToken("apple-6", "f@example.com"), rawNonce: TEST_RAW_NONCE },
    });
    const { accessToken, refreshToken } = signIn.json();

    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { refreshToken },
    });
    expect(logout.statusCode).toBe(204);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });
});
