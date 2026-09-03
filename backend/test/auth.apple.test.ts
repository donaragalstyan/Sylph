import { describe, it, expect } from "vitest";
import { verifyAppleIdentityToken, InvalidAppleIdentityTokenError, APPLE_ISSUER } from "../src/auth/apple.js";
import { buildTestIdentityKit } from "./helpers/providerTokens.js";

const AUDIENCE = "com.sylph.app.test";

describe("verifyAppleIdentityToken", () => {
  it("accepts a well-formed token and extracts identity claims", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      email: "person@example.com",
      email_verified: "true",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    const identity = await verifyAppleIdentityToken(token, kit.jwks);
    expect(identity).toEqual({
      providerUserId: "apple-user-123",
      email: "person@example.com",
      emailVerified: true,
    });
  });

  it("rejects a token with the wrong audience", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: "some-other-app",
      sub: "apple-user-123",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects a token with the wrong issuer", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: "https://not-apple.example.com",
      aud: AUDIENCE,
      sub: "apple-user-123",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyAppleIdentityToken(token, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects an expired token", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: APPLE_ISSUER,
      aud: AUDIENCE,
      sub: "apple-user-123",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(verifyAppleIdentityToken(token, kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });

  it("rejects garbage input", async () => {
    const kit = await buildTestIdentityKit();
    await expect(verifyAppleIdentityToken("not-a-jwt", kit.jwks)).rejects.toBeInstanceOf(
      InvalidAppleIdentityTokenError,
    );
  });
});
