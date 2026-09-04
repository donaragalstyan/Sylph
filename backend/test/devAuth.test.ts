import { describe, it, expect, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

describe("dev-only auth backdoor gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is unreachable (404) under the default test environment, where ENABLE_DEV_AUTH is unset", async () => {
    const { buildApp } = await import("../src/app.js");
    const app: FastifyInstance = await buildApp();

    const res = await app.inject({ method: "POST", url: "/v1/auth/dev-login", payload: {} });
    expect(res.statusCode).toBe(404);
  });

  it("is unreachable even with ENABLE_DEV_AUTH=true if NODE_ENV is production", async () => {
    vi.resetModules();
    vi.stubEnv("ENABLE_DEV_AUTH", "true");
    vi.stubEnv("NODE_ENV", "production");

    const { buildApp } = await import("../src/app.js");
    const app: FastifyInstance = await buildApp();

    const res = await app.inject({ method: "POST", url: "/v1/auth/dev-login", payload: {} });
    expect(res.statusCode).toBe(404);
  });

  it("is reachable and mints a real session only when explicitly enabled outside production", async () => {
    vi.resetModules();
    vi.stubEnv("ENABLE_DEV_AUTH", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { buildApp } = await import("../src/app.js");
    const app: FastifyInstance = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/dev-login",
      payload: { displayName: "Gating Test" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.user.displayName).toBe("Gating Test");
  });
});
