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
 * Verifies a Sign in with Apple `identityToken` (a signed JWT from the native SDK) against
 * Apple's published JWKS. This is identity verification only — no authorization-code exchange,
 * no Apple refresh token is requested or stored. See docs/PRODUCT_AND_COMPLIANCE.md §7.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  jwks: JWTVerifyGetKey = defaultAppleJwks,
): Promise<VerifiedAppleIdentity> {
  try {
    const { payload } = await jwtVerify(identityToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: env.APPLE_AUDIENCE,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new InvalidAppleIdentityTokenError("Missing subject claim");
    }

    const email = typeof payload["email"] === "string" ? payload["email"] : null;
    const emailVerifiedClaim = payload["email_verified"];
    const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";

    return { providerUserId: payload.sub, email, emailVerified };
  } catch (err) {
    if (err instanceof InvalidAppleIdentityTokenError) throw err;
    throw new InvalidAppleIdentityTokenError("Invalid or expired Apple identity token");
  }
}
