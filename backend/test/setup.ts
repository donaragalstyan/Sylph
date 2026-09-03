import { beforeEach, afterAll } from "vitest";
import { prisma } from "../src/db.js";

beforeEach(async () => {
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.authIdentity.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
