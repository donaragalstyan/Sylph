import { describe, it, expect } from "vitest";
import { verifyGoogleIdToken, InvalidGoogleIdentityTokenError } from "../src/auth/google.js";
import { buildTestIdentityKit } from "./helpers/providerTokens.js";

const AUDIENCE = "test-google-client-id.apps.googleusercontent.com";

describe("verifyGoogleIdToken", () => {
  it("accepts a well-formed token and extracts identity claims", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: "https://accounts.google.com",
      aud: AUDIENCE,
      sub: "google-user-456",
      email: "person@example.com",
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    const identity = await verifyGoogleIdToken(token, kit.jwks);
    expect(identity).toEqual({
      providerUserId: "google-user-456",
      email: "person@example.com",
      emailVerified: true,
    });
  });

  it("rejects a token with the wrong audience", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: "https://accounts.google.com",
      aud: "some-other-client-id",
      sub: "google-user-456",
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    await expect(verifyGoogleIdToken(token, kit.jwks)).rejects.toBeInstanceOf(
      InvalidGoogleIdentityTokenError,
    );
  });

  it("rejects an expired token", async () => {
    const kit = await buildTestIdentityKit();
    const token = await kit.signToken({
      iss: "https://accounts.google.com",
      aud: AUDIENCE,
      sub: "google-user-456",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(verifyGoogleIdToken(token, kit.jwks)).rejects.toBeInstanceOf(
      InvalidGoogleIdentityTokenError,
    );
  });
});
