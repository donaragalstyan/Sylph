import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { registerAuthRoutes } from "./auth/routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "test" ? "silent" : "info",
    },
  });

  await app.register(rateLimit, { global: false });

  await registerAuthRoutes(app);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
