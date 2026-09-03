/**
 * Shared between vitest.config.ts (test.env), globalSetup.ts (which runs outside the vitest
 * env and can't see test.env — same reason globalSetup.ts hardcodes the test DATABASE_URL
 * separately from env.ts), and any test that talks to storage directly.
 */
export const TEST_S3_CONFIG = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  bucket: "sylph-test",
  accessKeyId: "sylph-dev",
  secretAccessKey: "sylph-dev-secret",
};
