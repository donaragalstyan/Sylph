import type { AuthProvider, User } from "@prisma/client";
import { prisma } from "../db.js";
import { signAccessToken } from "./jwt.js";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "./refreshToken.js";

export interface VerifiedProviderIdentity {
  provider: AuthProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * The single point where any provider's verified identity becomes a Sylph User. Nothing past
 * this function knows or cares which provider was used. See docs/PRODUCT_AND_COMPLIANCE.md §7:
 * identities are never auto-linked across providers by email.
 */
export async function findOrCreateUser(
  identity: VerifiedProviderIdentity,
  displayName?: string,
): Promise<User> {
  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: identity.provider,
        providerUserId: identity.providerUserId,
      },
    },
    include: { user: true },
  });

  if (existing) {
    if (existing.user.deletedAt) {
      throw new AccountDeletedError();
    }
    await prisma.authIdentity.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date() },
    });
    return existing.user;
  }

  const user = await prisma.user.create({
    data: {
      displayName: displayName ?? null,
      identities: {
        create: {
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          email: identity.email,
          emailVerified: identity.emailVerified,
        },
      },
    },
  });

  return user;
}

export class AccountDeletedError extends Error {}
export class InvalidRefreshTokenError extends Error {}

export async function issueSession(
  userId: string,
  options?: { deviceInfo?: string; platform?: string },
): Promise<IssuedTokens> {
  const refreshToken = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      deviceInfo: options?.deviceInfo,
      platform: options?.platform,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  const accessToken = await signAccessToken({ sub: userId, sid: session.id });
  return { accessToken, refreshToken };
}

/**
 * Rotates a refresh token in place (same session row, new hash + expiry). Access tokens are
 * short-lived (15 min) and verified statelessly (§7) — logout/rotation take effect for future
 * refreshes immediately, but an already-issued access token remains valid until it naturally
 * expires. This is a deliberate simplicity tradeoff for Phase 1's low-sensitivity data.
 */
export async function rotateRefreshToken(rawRefreshToken: string): Promise<IssuedTokens> {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashRefreshToken(rawRefreshToken) },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError();
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt) {
    throw new InvalidRefreshTokenError();
  }

  const refreshToken = generateRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  const accessToken = await signAccessToken({ sub: session.userId, sid: session.id });
  return { accessToken, refreshToken };
}

export async function revokeSessionByRefreshToken(rawRefreshToken: string): Promise<void> {
  const hash = hashRefreshToken(rawRefreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getActiveUserById(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return null;
  return user;
}
