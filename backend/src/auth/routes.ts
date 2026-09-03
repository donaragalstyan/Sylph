import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyAppleIdentityToken, InvalidAppleIdentityTokenError } from "./apple.js";
import { verifyGoogleIdToken, InvalidGoogleIdentityTokenError } from "./google.js";
import {
  findOrCreateUser,
  issueSession,
  rotateRefreshToken,
  revokeSessionByRefreshToken,
  getActiveUserById,
  AccountDeletedError,
  InvalidRefreshTokenError,
} from "./service.js";
import { requireAuth } from "../plugins/authenticate.js";
import { prisma } from "../db.js";

const appleSignInSchema = z.object({
  identityToken: z.string().min(1),
  displayName: z.string().trim().min(1).max(80).optional(),
});

const googleSignInSchema = z.object({
  idToken: z.string().min(1),
  displayName: z.string().trim().min(1).max(80).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const AUTH_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/auth/apple",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = appleSignInSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
      }

      let identity;
      try {
        identity = await verifyAppleIdentityToken(parsed.data.identityToken);
      } catch (err) {
        if (err instanceof InvalidAppleIdentityTokenError) {
          return reply.code(401).send({ error: "invalid_token", message: err.message });
        }
        throw err;
      }

      return completeSignIn(reply, "APPLE", identity, parsed.data.displayName, request);
    },
  );

  app.post(
    "/v1/auth/google",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = googleSignInSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
      }

      let identity;
      try {
        identity = await verifyGoogleIdToken(parsed.data.idToken);
      } catch (err) {
        if (err instanceof InvalidGoogleIdentityTokenError) {
          return reply.code(401).send({ error: "invalid_token", message: err.message });
        }
        throw err;
      }

      return completeSignIn(reply, "GOOGLE", identity, parsed.data.displayName, request);
    },
  );

  app.post(
    "/v1/auth/refresh",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
      }

      try {
        const tokens = await rotateRefreshToken(parsed.data.refreshToken);
        return reply.send(tokens);
      } catch (err) {
        if (err instanceof InvalidRefreshTokenError) {
          return reply.code(401).send({ error: "invalid_refresh_token" });
        }
        throw err;
      }
    },
  );

  app.post(
    "/v1/auth/logout",
    { preHandler: requireAuth, config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
      }
      await revokeSessionByRefreshToken(parsed.data.refreshToken);
      return reply.code(204).send();
    },
  );

  app.get("/v1/me", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const user = await getActiveUserById(userId);
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const identities = await prisma.authIdentity.findMany({
      where: { userId: user.id },
      select: { provider: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({
      id: user.id,
      displayName: user.displayName,
      identities,
    });
  });
}

async function completeSignIn(
  reply: import("fastify").FastifyReply,
  provider: "APPLE" | "GOOGLE",
  identity: { providerUserId: string; email: string | null; emailVerified: boolean },
  displayName: string | undefined,
  request: import("fastify").FastifyRequest,
) {
  try {
    const user = await findOrCreateUser({ provider, ...identity }, displayName);
    const platform = request.headers["x-sylph-platform"];
    const tokens = await issueSession(user.id, {
      platform: typeof platform === "string" ? platform : undefined,
    });
    return reply.send({
      ...tokens,
      user: { id: user.id, displayName: user.displayName },
    });
  } catch (err) {
    if (err instanceof AccountDeletedError) {
      return reply.code(403).send({ error: "account_deleted" });
    }
    throw err;
  }
}
