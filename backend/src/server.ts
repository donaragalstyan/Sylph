import "dotenv/config";
import { env } from "./env.js";
import { buildApp } from "./app.js";
import { ensureBucketExists } from "./storage/s3.js";

async function main() {
  await ensureBucketExists();
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
