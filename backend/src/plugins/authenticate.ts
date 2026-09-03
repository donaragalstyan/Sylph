import type { FastifyReply, FastifyRequest } from "fastify";
import { InvalidAccessTokenError, verifyAccessToken } from "../auth/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * preHandler that requires a valid Sylph access token and sets `request.userId`. This is the
 * only place authentication is enforced; every authorized route composes this, never its own
 * ad-hoc check. See docs/PRODUCT_AND_COMPLIANCE.md §5: authorization is server-side, never
 * inferred from route naming or client-supplied identifiers.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = await verifyAccessToken(token);
    request.userId = payload.sub;
  } catch (err) {
    if (err instanceof InvalidAccessTokenError) {
      return reply.code(401).send({ error: "unauthorized", message: err.message });
    }
    throw err;
  }
}
