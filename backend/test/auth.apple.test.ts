import { describe, it, expect } from "vitest";
import {
  verifyAppleIdentityToken,
  hashAppleNonce,
  InvalidAppleIdentityTokenError,
  InvalidAppleNonceError,
  APPLE_ISSUER,
} from "../src/auth/apple.js";
import { buildTestIdentityKit } from "./helpers/providerTokens.js";

const AUDIENCE = "com.sylph.app.test";
const RAW_NONCE = "test-raw-nonce-abcdef0123456789";

describe("verifyAppleIdentityToken", () => {
  it("accepts a well-formed token with a matching nonce and extracts identity claims", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      email: "person@example.com",
      email_verified: "true",
      nonce: hashAppleNonce(RAW_NONCE),
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    const identity = await verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks);
    expect(identity).toEqual({
      providerUserId: "apple-user-123",
      email: "person@example.com",
      emailVerified: true,
    });
  });

  it("rejects a token whose nonce claim does not match the raw nonce presented", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      nonce: hashAppleNonce("a-completely-different-nonce"),
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleNonceError,
    );
  });

  it("rejects a token with no nonce claim at all, since we always request one", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      exp: Math.floor(Date.now() / 1000) + 300,
      // no `nonce` claim — simulates a token minted without our nonce (e.g. replay of a
      // token obtained through a different, non-nonce'd flow)
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleNonceError,
    );
  });

  it("rejects a token with a non-string nonce claim", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      nonce: 12345,
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleNonceError,
    );
  });

  it("a nonce mismatch is still an InvalidAppleIdentityTokenError", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      nonce: hashAppleNonce("wrong-nonce-value-here"),
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects a token with the wrong audience", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: "some-other-app",
      sub: "apple-user-123",
      nonce: hashAppleNonce(RAW_NONCE),
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects a token with the wrong issuer", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: "https://not-apple.example.com",
      aud: AUDIENCE,
      sub: "apple-user-123",
      nonce: hashAppleNonce(RAW_NONCE),
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects an expired token", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      nonce: hashAppleNonce(RAW_NONCE),
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(verifyAppleIdentityToken(token, RAW_NONCE, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects garbage input", async () => {
    const kit = await buildTestIdentityKit();
    await expect(
      verifyAppleIdentityToken("not-a-jwt", RAW_NONCE, kit.jwks),
    ).rejects.toBeInstanceOf(InvalidAppleIdentityTokenError);
  });
});

describe("hashAppleNonce", () => {
  it("is deterministic and produces a lowercase hex SHA-256 digest", () => {
    const hash = hashAppleNonce("some-raw-nonce");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashAppleNonce("some-raw-nonce"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashAppleNonce("nonce-a")).not.toBe(hashAppleNonce("nonce-b"));
  });
});
