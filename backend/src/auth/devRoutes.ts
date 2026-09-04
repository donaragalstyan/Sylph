import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { issueSession } from "./service.js";

const devLoginSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
});

/**
 * A non-provider-verified sign-in path, ONLY for exercising the mobile app's authenticated
 * screens against a real local backend before an actual Apple/Google developer account is
 * configured (Step 3). Deliberately does NOT touch AuthIdentity/AuthProvider at all — it just
 * creates a bare User and issues a real session via the same `issueSession` every other sign-in
 * path uses, so nothing downstream needs to know this path exists.
 *
 * Gated at the call site (see app.ts) behind `env.ENABLE_DEV_AUTH === true`, which itself
 * defaults to false and must be explicitly set — this route is not even registered otherwise,
 * so it 404s rather than being reachable-but-rejecting. Must never be enabled outside local
 * development. See docs/PRODUCT_AND_COMPLIANCE.md §7.
 */
export async function registerDevAuthRoutes(app: FastifyInstance): Promise<void> {
  app.log.warn(
    "ENABLE_DEV_AUTH is on — POST /v1/auth/dev-login is reachable with no identity verification. " +
      "This must never be enabled outside local development.",
  );

  app.post("/v1/auth/dev-login", async (request, reply) => {
    const parsed = devLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const user = await prisma.user.create({
      data: { displayName: parsed.data.displayName ?? "Dev Tester" },
    });
    const tokens = await issueSession(user.id, { platform: "dev" });

    return reply.send({ ...tokens, user: { id: user.id, displayName: user.displayName } });
  });
}
