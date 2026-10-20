// scripts/backfill-driver-ssn-encrypted.ts
//
// ONE-TIME, LOSSLESS backfill: gives every pre-encryption driver a proper
// AES-256-GCM full-SSN record so the admin reveal (decrypt icon) works for
// EVERYONE — not only drivers who onboarded after encrypted storage existed.
// Without it, the reveal endpoint answers NOT_ON_FILE for all legacy drivers
// even though their full SSN is sitting in ssnLastFour (restored by
// restore-driver-identity-original.ts).
//
// WHY THIS IS SAFE — the opposite of the old migration incident:
//   1. encrypts the full 9-digit value with the app's OWN crypto
//      (src/driver/ssn-crypto.util.ts — the exact same key the live server
//      uses, because it imports the same module and reads the same .env),
//   2. round-trip VERIFIES the ciphertext decrypts back to the exact
//      original BEFORE touching anything,
//   3. only then truncates ssnLastFour to its last 4 digits.
//   Nothing is destroyed: the full SSN survives encrypted in ssnEncrypted,
//   decryptable only by the server through the audit-logged admin reveal.
//
// SCOPE (rows touched): Driver.ssnEncrypted IS NULL AND ssnLastFour holds a
// clean 9-digit value. Everything else stays untouched — ssnHash and
// licenseNumberHash remain NULL (uniqueness stays new-registrations-only),
// license fields, Stripe ids, status: all untouched.
//
// Rows whose ssnLastFour is already just 4 digits (stored correctly all
// along) have no full SSN anywhere — no script can create it — and are
// reported, left alone, and keep showing NOT_ON_FILE in the admin panel.
//
// KEY SOURCE: the script prints which key source is in effect (never the
// secret itself). Run it ON THE SERVER from backend/ so its env matches the
// running app; if the app runs with a env var that is NOT in backend/.env
// (e.g. injected by systemd), export it the same way before running, or the
// server would report DECRYPT_FAILED for the newly encrypted rows.
//
// USAGE (on the server, from backend/):
//   npx ts-node scripts/backfill-driver-ssn-encrypted.ts           # dry run
//   npx ts-node scripts/backfill-driver-ssn-encrypted.ts --apply
// After applying, verify one driver in the admin panel (decrypt icon shows
// the full SSN and an AdminAuditLog row is written per reveal).

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encryptSsn, decryptSsn } from "../src/driver/ssn-crypto.util";

function maskSsn(full: string): string {
  return full.slice(0, 2) + "•••••" + full.slice(5);
}

/** Mirror of ssn-crypto.util deriveKey() — reports the SOURCE, never the value. */
function keySourceLabel(): string {
  const explicit = process.env.SSN_ENCRYPTION_KEY;
  if (explicit && explicit.trim().length >= 8) {
    return "SSN_ENCRYPTION_KEY env var (recommended)";
  }
  const serverSecret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "";
  if (serverSecret.length >= 8) {
    return "derived from JWT secret — consider setting SSN_ENCRYPTION_KEY for an independent rotation lifecycle";
  }
  return "DEV-ONLY fallback key — do NOT run against production like this";
}

async function main() {
  // Same pattern as every script in this folder: env BEFORE PrismaClient.
  dotenv.config();
  const prisma = new PrismaClient();

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  console.log(`Mode: ${apply ? "APPLY — rows WILL be written" : "DRY RUN — nothing is written"}`);
  console.log(`Key source: ${keySourceLabel()}`);
  console.log("");

  const rows = await prisma.driver.findMany({
    where: { ssnEncrypted: null },
    select: {
      id: true,
      ssnLastFour: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const inScope = rows.filter((r) => r.ssnLastFour && /^\d{9}$/.test(r.ssnLastFour));
  const alreadyFour = rows.length - inScope.length;

  console.log(`Drivers without encrypted SSN: ${rows.length}`);
  console.log(`  in scope (full 9 digits available): ${inScope.length}`);
  console.log(`  only 4 digits stored (true legacy, cannot backfill): ${alreadyFour}`);
  console.log("");

  let backfilled = 0;
  let failed = 0;

  for (const r of inScope) {
    const full: string = r.ssnLastFour as string;
    const tag = `${r.id} ${r.user?.email ?? "(no email)"}`;

    const encrypted = encryptSsn(full);
    const roundTrip = encrypted ? decryptSsn(encrypted) : null;
    if (!encrypted || roundTrip !== full) {
      failed++;
      console.log(`FAILED round-trip verification — row untouched: ${tag}`);
      continue;
    }

    console.log(
      `${apply ? "BACKFILLED" : "WOULD BACKFILL"}: ${tag} ${maskSsn(full)} -> ssnEncrypted (ssnLastFour becomes ${full.slice(-4)})`,
    );

    if (apply) {
      await prisma.driver.update({
        where: { id: r.id },
        data: { ssnEncrypted: encrypted, ssnLastFour: full.slice(-4) },
      });
    }
    backfilled++;
  }

  console.log("");
  console.log(`Summary: ${backfilled} ${apply ? "backfilled" : "would backfill"} | ${failed} failed (untouched) | ${alreadyFour} true-legacy left as-is`);
  if (!apply && backfilled > 0) {
    console.log("Re-run with --apply to write. After applying, test one reveal in the admin panel.");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
