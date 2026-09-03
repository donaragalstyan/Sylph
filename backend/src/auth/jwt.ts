import { SignJWT, jwtVerify } from "jose";
import { env } from "../env.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export class InvalidAccessTokenError extends Error {}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string" || typeof payload["sid"] !== "string") {
      throw new InvalidAccessTokenError("Malformed access token payload");
    }
    return { sub: payload.sub, sid: payload["sid"] as string };
  } catch {
    throw new InvalidAccessTokenError("Invalid or expired access token");
  }
}
