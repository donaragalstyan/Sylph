import { randomBytes, createHash } from "node:crypto";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** A raw, high-entropy opaque refresh token. Only ever returned to the client, never stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 is sufficient here: the input is a 256-bit random token, not a low-entropy secret
 * like a password, so no slow/salted hash is needed to resist offline guessing. */
export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
