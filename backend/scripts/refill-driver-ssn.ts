// scripts/refill-driver-ssn.ts
//
// REFILL driver SSNs that cannot be restored, so the admin eye icon works
// for every driver. Intended for TEST accounts — this WRITES NEW SSNs.
//
// HONEST SCOPE — who gets refilled and why:
//   REFILLED (fake SSN assigned, encrypted under the CURRENT server key):
//     • true-legacy rows: ssnEncrypted NULL, ssnLastFour holds 4 digits, and
//       no ssnHash exists — the full 9 digits were never stored anywhere, so
//       NO script can ever restore them. Refill is the only path.
//     • rows whose ssnEncrypted cannot be decrypted under ANY known key
//       (the key text that wrote them is gone) — overwritten, since the old
//       value is unrecoverable anyway.
//   LEFT ALONE (on purpose):
//     • rows with a 9-digit ssnLastFour and no ciphertext: that is REAL,
//       recovered data (restore-driver-identity-original.ts). Those belong to
//       backfill-driver-ssn-encrypted.ts — refilling them would DESTROY real
//       numbers with fake ones. The script reports them and refuses.
//     • rows whose ciphertext decrypts under some known key (rotate:ssn-key
//       can migrate them to the current key, preserving the real SSN).
//       Overridable with --force for test accounts that truly don't care.
//   EVERY REFILLED ROW KEEPS ssnHash = NULL → uniqueness still binds NEW
//   registrations only (the project's zero-touch contract). Fake SSNs can
//   never block a future real signup.
//
// OPTIONS:
//   --apply          write (default is dry run, nothing written)
//   --prefix NNNNNN  fix area+group to these 6 digits so refilled SSNs are
//                    instantly recognizable as test data (e.g. 890456xxx)
//   --force          also overwrite rows whose real SSN IS still recoverable
//                    via rotate:ssn-key (test accounts only — data loss for
//                    those rows)
//
// KEY RULE: rows are encrypted under the key the CURRENT .env resolves to.
// Restart the app after any .env change so the reveal uses the same key.
//
// USAGE (on the server, from backend/):
//   npx ts-node scripts/refill-driver-ssn.ts                      # dry run
//   npx ts-node scripts/refill-driver-ssn.ts --apply              # random SSNs
//   npx ts-node scripts/refill-driver-ssn.ts --apply --prefix 890456
// Then: restart the app -> run backfill --verify (expect 100% OK) -> test the
// eye icon in the admin panel (each reveal writes an AdminAuditLog row).

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { decryptSsn, encryptSsn } from "../src/driver/ssn-crypto.util";
import {
  classifyEncryptedSsn,
  currentKeyResolutionLabel,
  currentKeySource,
} from "./lib/ssn-rekey-core";
import { decideRefill, generatePlausibleSsn, isValidPrefix } from "./lib/ssn-refill-core";

function maskSsn(full: string): string {
  return full.slice(0, 2) + "•••••" + full.slice(5);
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const force = argv.includes("--force");
  const prefixIdx = argv.indexOf("--prefix");
  const prefix = prefixIdx >= 0 ? argv[prefixIdx + 1] : undefined;
  return { apply, force, prefix };
}

async function main() {
  // Same pattern as every script in this folder: env BEFORE PrismaClient.
  // ssn-crypto.util resolves its key per CALL, never at module load.
  dotenv.config();

  const { apply, force, prefix } = parseArgs(process.argv.slice(2));

  if (!isValidPrefix(prefix)) {
    console.error("--prefix must be exactly 6 digits (area + group), e.g. --prefix 890456");
    process.exit(1);
  }

  console.log(`Mode: ${apply ? "APPLY — new SSNs WILL be written" : "DRY RUN — nothing is written"}`);
  console.log(`Current key resolution: ${currentKeyResolutionLabel()}`);
  console.log(`Refill style: ${prefix ? `recognizable test data ${prefix}xxx` : "random plausible SSNs"}${force ? " | --force: recoverable rows WILL also be overwritten" : ""}`);
  console.log("");

  if (apply && currentKeySource() === "dev") {
    console.error("REFUSING --apply: the current env resolves to the DEV-ONLY fallback key");
    console.error("(no SSN_ENCRYPTION_KEY and no JWT secret visible to this process).");
    console.error("Rows would be encrypted under a dev key the production app cannot open.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const rows = await prisma.driver.findMany({
    select: {
      id: true,
      ssnEncrypted: true,
      ssnLastFour: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const used = new Set<string>();
  let refilled = 0;
  let recoverableSkipped = 0;
  let backfillJobSkipped = 0;
  let nothingStored = 0;
  let failed = 0;

  for (const r of rows) {
    const tag = `${r.id} ${r.user?.email ?? "(no email)"}`;

    const recoverable = r.ssnEncrypted
      ? classifyEncryptedSsn(r.ssnEncrypted) !== "UNDECRYPTABLE"
      : false;
    let decision = decideRefill(
      { ssnEncrypted: r.ssnEncrypted, ssnLastFour: r.ssnLastFour },
      recoverable,
    );

    if (decision.action === "SKIP_RECOVERABLE" && force) {
      console.log(`FORCED over a RECOVERABLE row (--force): ${tag} — its real SSN was still readable via rotate:ssn-key`);
      decision = { action: "REFILL" };
    }

    switch (decision.action) {
      case "SKIP_BACKFILL_JOB":
        backfillJobSkipped++;
        console.log(`KEPT (real full SSN on file — run backfill:ssn-encrypted for this one, NOT refill): ${tag}`);
        continue;
      case "SKIP_RECOVERABLE":
        recoverableSkipped++;
        console.log(`KEPT (ciphertext decrypts under a known key — run rotate:ssn-key to preserve the real SSN, or re-run with --force): ${tag}`);
        continue;
      case "SKIP_NOTHING_STORED":
        nothingStored++;
        console.log(`SKIPPED (no SSN of any kind stored): ${tag}`);
        continue;
    }

    // REFILL
    let newSsn: string;
    try {
      newSsn = generatePlausibleSsn(prefix, used);
    } catch (e) {
      failed++;
      console.error(`FAILED to generate SSN for ${tag}: ${(e as Error).message}`);
      continue;
    }
    const encrypted = encryptSsn(newSsn); // under the CURRENT env resolution — the key the app uses after restart
    const roundTrip = encrypted ? decryptSsn(encrypted) : null;
    if (!encrypted || roundTrip !== newSsn) {
      failed++;
      console.log(`FAILED round-trip verification — row untouched: ${tag}`);
      continue;
    }

    console.log(
      `${apply ? "REFILLED" : "WOULD REFILL"}: ${tag} ${maskSsn(newSsn)} -> ssnEncrypted (ssnLastFour becomes ${newSsn.slice(-4)}; ssnHash stays NULL)`,
    );

    if (apply) {
      await prisma.driver.update({
        where: { id: r.id },
        data: { ssnEncrypted: encrypted, ssnLastFour: newSsn.slice(-4) },
      });
    }
    refilled++;
  }

  console.log("");
  console.log(
    `Summary: ${refilled} ${apply ? "refilled" : "would refill"} | ${backfillJobSkipped} kept (real SSN — backfill's job) | ${recoverableSkipped} kept (recoverable — rotate's job) | ${nothingStored} nothing stored | ${failed} failed`,
  );
  console.log("");

  if (!apply && refilled > 0) {
    console.log("Re-run with --apply to write. Add --prefix 890456 (any 6 digits) to make refilled SSNs recognizable as test data.");
  }
  if (backfillJobSkipped > 0) {
    console.log(`IMPORTANT: ${backfillJobSkipped} driver(s) hold a REAL recovered 9-digit SSN. Refill refuses to fake those.`);
    console.log("Give the eye icon their real SSN with: npx ts-node scripts/backfill-driver-ssn-encrypted.ts (dry run, then --apply).");
  }
  if (recoverableSkipped > 0) {
    console.log(`${recoverableSkipped} row(s) still decrypt under a known key — rotate:ssn-key migrates them to the current key WITHOUT losing the real SSN.`);
  }
  if (apply && refilled > 0) {
    console.log("NEXT STEPS:");
    console.log("  1. RESTART the backend app so the reveal uses the same key the refills were written under.");
    console.log("  2. Run: npx ts-node scripts/backfill-driver-ssn-encrypted.ts --verify  (expect 100% OK)");
    console.log("  3. Test the eye icon in the admin panel (each reveal writes an AdminAuditLog row).");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
