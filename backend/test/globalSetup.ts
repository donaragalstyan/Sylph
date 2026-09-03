import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { TEST_S3_CONFIG } from "./helpers/s3Config.js";

const TEST_DATABASE_URL = "postgresql://sylph:sylph@localhost:5432/sylph_test";
const ADMIN_DATABASE_URL = "postgresql://sylph:sylph@localhost:5432/postgres";

async function ensureTestBucket(): Promise<void> {
  const s3 = new S3Client({
    endpoint: TEST_S3_CONFIG.endpoint,
    region: TEST_S3_CONFIG.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: TEST_S3_CONFIG.accessKeyId,
      secretAccessKey: TEST_S3_CONFIG.secretAccessKey,
    },
  });

  const attempts = 15;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: TEST_S3_CONFIG.bucket }));
      return;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) {
        await s3.send(new CreateBucketCommand({ Bucket: TEST_S3_CONFIG.bucket }));
        return;
      }
      if (attempt === attempts) {
        throw new Error(
          `MinIO not reachable at ${TEST_S3_CONFIG.endpoint} after ${attempts} attempts. ` +
            `Run \`pnpm infra:up\` (or \`docker compose up -d minio\`) before testing.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export default async function globalSetup(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DATABASE_URL } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE sylph_test`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("already exists")) throw err;
  } finally {
    await admin.$disconnect();
  }

  execSync("pnpm exec prisma migrate deploy", {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  await ensureTestBucket();
}
