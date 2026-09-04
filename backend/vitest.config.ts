import { defineConfig } from "vitest/config";
import { TEST_S3_CONFIG } from "./test/helpers/s3Config.js";

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
      S3_ENDPOINT: TEST_S3_CONFIG.endpoint,
      S3_REGION: TEST_S3_CONFIG.region,
      S3_BUCKET: TEST_S3_CONFIG.bucket,
      S3_ACCESS_KEY_ID: TEST_S3_CONFIG.accessKeyId,
      S3_SECRET_ACCESS_KEY: TEST_S3_CONFIG.secretAccessKey,
      S3_FORCE_PATH_STYLE: "true",
      PORT: "3999",
      // Explicit, not just relying on the zod default — a test run must never silently inherit
      // ENABLE_DEV_AUTH=true from the ambient shell/.env (see test/devAuth.test.ts for why this
      // matters: it's the whole thing being gated).
      ENABLE_DEV_AUTH: "false",
    },
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
