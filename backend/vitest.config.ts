import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./test/globalSetup.ts",
    setupFiles: ["./test/setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://sylph:sylph@localhost:5432/sylph_test",
      JWT_ACCESS_SECRET: "test-only-secret-not-for-production-use",
      APPLE_AUDIENCE: "com.sylph.app.test",
      GOOGLE_CLIENT_ID: "test-google-client-id.apps.googleusercontent.com",
      PORT: "3999",
    },
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
