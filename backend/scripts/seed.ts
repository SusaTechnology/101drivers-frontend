// src/scripts/seed.ts
import * as dotenv from "dotenv";
import { parseSalt } from "../src/auth/password.service";
import { seedAll } from "./seed/index";
import { prisma } from "./seed/utils";

async function main() {
  dotenv.config();

  const { BCRYPT_SALT } = process.env;
  if (!BCRYPT_SALT) throw new Error("BCRYPT_SALT environment variable must be defined");

  const salt = parseSalt(BCRYPT_SALT);

  console.info("Seeding database (role fixtures)...");
  await seedAll(salt);
  console.info("Seeded database successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });  
