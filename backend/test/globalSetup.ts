import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL = "postgresql://sylph:sylph@localhost:5432/sylph_test";
const ADMIN_DATABASE_URL = "postgresql://sylph:sylph@localhost:5432/postgres";

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
}
