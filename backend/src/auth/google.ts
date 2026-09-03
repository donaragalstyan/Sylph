import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { env } from "../env.js";

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const defaultGoogleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export interface VerifiedGoogleIdentity {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
}

export class InvalidGoogleIdentityTokenError extends Error {}

/**
 * Verifies a Sign in with Google `idToken` (from the native SDK) against Google's published
 * JWKS. This is identity verification only — no server auth code is requested, no Google
 * refresh token is stored. See docs/PRODUCT_AND_COMPLIANCE.md §7.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  jwks: JWTVerifyGetKey = defaultGoogleJwks,
): Promise<VerifiedGoogleIdentity> {
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: env.GOOGLE_CLIENT_ID,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new InvalidGoogleIdentityTokenError("Missing subject claim");
    }

    const email = typeof payload["email"] === "string" ? payload["email"] : null;
    const emailVerifiedClaim = payload["email_verified"];
    const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";

    return { providerUserId: payload.sub, email, emailVerified };
  } catch (err) {
    if (err instanceof InvalidGoogleIdentityTokenError) throw err;
    throw new InvalidGoogleIdentityTokenError("Invalid or expired Google identity token");
  }
}
