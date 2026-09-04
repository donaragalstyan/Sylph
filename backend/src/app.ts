import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerClosetRoutes } from "./closet/routes.js";
import { registerDevAuthRoutes } from "./auth/devRoutes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "test" ? "silent" : "info",
    },
  });

  await app.register(rateLimit, { global: false });

  await registerAuthRoutes(app);
  await registerClosetRoutes(app);

  // Route only exists at all when explicitly opted into — see src/auth/devRoutes.ts.
  if (env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH) {
    await registerDevAuthRoutes(app);
  }

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
