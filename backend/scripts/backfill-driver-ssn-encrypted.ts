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
//   npx ts-node scripts/backfill-driver-ssn-encrypted.ts --verify  # strictly read-only proof:
//       decrypts EVERY stored ssnEncrypted under the CURRENT server key and
//       cross-checks it against the stored ssnLastFour. Zero writes. Run it
//       after --apply (expect 100% OK) and after ANY key/env change.
//
// BEFORE --apply, decide the key: rows encrypt under whatever key is active
// at apply time (see KEY SOURCE line the script prints). Changing
// SSN_ENCRYPTION_KEY or rotating the JWT secret AFTERwards makes those rows
// undecryptable (admin reveal shows DECRYPT_FAILED) — --verify identifies
// exactly which rows are affected. After applying, also test one reveal in
// the admin panel (decrypt icon shows the full SSN and an AdminAuditLog row
// is written per reveal).

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

/**
 * --verify: read-only, end-to-end proof that the data on file is RIGHT.
 * Decrypts every stored ssnEncrypted with the CURRENT server key (the same
 * deriveKey() the live admin reveal uses) and cross-checks it against the
 * stored ssnLastFour. This is what the admin reveal depends on, so
 * 100% OK here == the decrypt icon works for every encrypted driver.
 * Categories: OK | UNDECRYPTABLE (key changed since that row was written)
 *           | MISMATCH (decrypts but stored last-4 disagrees) | ANOMALY.
 */
async function verifyExisting(prisma: PrismaClient) {
  const rows = await prisma.driver.findMany({
    where: { ssnEncrypted: { not: null } },
    select: {
      id: true,
      ssnEncrypted: true,
      ssnLastFour: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Drivers with an encrypted SSN on file: ${rows.length}`);
  if (rows.length === 0) {
    console.log("Nothing to verify yet — run the backfill first (dry run, then --apply).");
    return;
  }

  let ok = 0;
  let undecryptable = 0;
  let mismatch = 0;
  let anomalous = 0;

  for (const r of rows) {
    const tag = `${r.id} ${r.user?.email ?? "(no email)"}`;
    const decrypted = decryptSsn(r.ssnEncrypted);

    if (!decrypted) {
      undecryptable++;
      console.log(`UNDECRYPTABLE under the CURRENT key: ${tag}`);
      continue;
    }
    if (r.ssnLastFour && /^\d{9}$/.test(r.ssnLastFour)) {
      anomalous++;
      console.log(`ANOMALY — ssnLastFour still holds 9 digits on an encrypted row: ${tag}`);
      continue;
    }
    if (r.ssnLastFour !== decrypted.slice(-4)) {
      mismatch++;
      console.log(
        `MISMATCH — decrypts to ${maskSsn(decrypted)} but ssnLastFour says ${r.ssnLastFour ?? "(null)"}: ${tag}`,
      );
      continue;
    }
    ok++;
  }

  console.log("");
  console.log(
    `Verify summary: ${ok} OK | ${undecryptable} undecryptable | ${mismatch} last-4 mismatch | ${anomalous} anomalous`,
  );
  if (ok === rows.length) {
    console.log(
      "EVERY encrypted SSN on file decrypts correctly under the CURRENT server key, and every stored last-4 matches. The data is provably right.",
    );
  }
  if (undecryptable > 0) {
    console.log(
      "Undecryptable rows were written under a DIFFERENT key than the one active now " +
        "(SSN_ENCRYPTION_KEY set/unset since the backfill, or the JWT secret rotated). " +
        "Restore the key that was active when the backfill ran, restart, and re-run --verify.",
    );
  }
}

async function main() {
  // Same pattern as every script in this folder: env BEFORE PrismaClient.
  // Safe here even with static imports: ssn-crypto.util resolves its key
  // per CALL (deriveKey() inside encrypt/decrypt), never at module load.
  dotenv.config();
  const prisma = new PrismaClient();

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const verify = args.includes("--verify");
  if (apply && verify) {
    console.error("--apply and --verify are mutually exclusive (--verify is strictly read-only).");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `Mode: ${apply ? "APPLY — rows WILL be written" : verify ? "VERIFY — strictly read-only" : "DRY RUN — nothing is written"}`,
  );
  console.log(`Key source: ${keySourceLabel()}`);
  console.log("");

  if (verify) {
    await verifyExisting(prisma);
    await prisma.$disconnect();
    return;
  }

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
    console.log("Re-run with --apply to write. After applying, run --verify for the 100%-OK proof, then test one reveal in the admin panel.");
  }
  if (apply && backfilled > 0) {
    console.log("Now run: npx ts-node scripts/backfill-driver-ssn-encrypted.ts --verify");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
