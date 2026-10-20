// scripts/rotate-driver-ssn-encryption-key.ts
//
// Diagnostic + migration tool for Driver.ssnEncrypted rows whose key changed.
//
// SYMPTOM IT FIXES
// Admin reveal answers: "The stored SSN could not be decrypted. The server's
// SSN_ENCRYPTION_KEY does not match the key used when this driver registered."
// That happens when rows were written under key X but the app now resolves
// key Y — e.g. the backfill/signups ran while .env had NO SSN_ENCRYPTION_KEY
// (rows under the JWT-derived key), and an SSN_ENCRYPTION_KEY was added to
// .env afterwards. NOTHING IS LOST — the rows just live under the old key.
//
// WHAT IT DOES
//   DRY RUN (default): probes every encrypted row with the app's REAL
//     decryptSsn under every plausible key (current env -> OLD_SSN_ENCRYPTION_KEY
//     -> JWT-derived -> dev fallback) and reports exactly which key each row
//     was written under. Zero writes.
//   --apply: rows already under the CURRENT env key are left alone; every
//     other row is decrypted under its identified key, re-encrypted under the
//     CURRENT key (round-trip + stored-last-4 verified BEFORE writing, and a
//     negative check that the new ciphertext no longer opens with the old
//     key), then updated. Only ssnEncrypted changes — never ssnLastFour,
//     hashes, or any other column.
//
// KEY RULES
//   • Decide the FINAL SSN_ENCRYPTION_KEY text in .env BEFORE --apply, and
//     never change it afterwards without running this script again.
//   • RESTART the backend app after any .env change — the running process
//     reads env only at boot. The app's key and the data's key must agree.
//   • If rows were encrypted under an older key text that is no longer in
//     .env, put THAT text in OLD_SSN_ENCRYPTION_KEY (in .env or the shell)
//     for this run — the script will migrate those rows to the current key.
//     NEVER pass secrets as CLI arguments (shell history).
//   • The script refuses --apply when the current env resolves to the
//     DEV-ONLY fallback (no real secrets configured).
//
// USAGE (on the server, from backend/):
//   npx ts-node scripts/rotate-driver-ssn-encryption-key.ts            # dry run
//   npx ts-node scripts/rotate-driver-ssn-encryption-key.ts --apply    # migrate
// Then: restart the app -> run backfill --verify (expect 100% OK) -> test one
// reveal in the admin panel.

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  buildSsnRekeyUpdate,
  candidateProbeOrder,
  classifyEncryptedSsn,
  currentKeyResolutionLabel,
  currentKeySource,
} from "./lib/ssn-rekey-core";

function maskSsn(full: string): string {
  return full.slice(0, 2) + "•••••" + full.slice(5);
}

async function main() {
  // Same pattern as every script in this folder: env BEFORE PrismaClient.
  // ssn-crypto.util resolves its key per CALL, never at module load.
  dotenv.config();

  const apply = process.argv.slice(2).includes("--apply");

  console.log(`Mode: ${apply ? "APPLY — rows WILL be re-encrypted under the current key" : "DRY RUN — nothing is written"}`);
  console.log(`Current key resolution: ${currentKeyResolutionLabel()}`);
  console.log(`Decrypt candidates probed: ${candidateProbeOrder().join(" -> ")}`);
  console.log("");

  if (apply && currentKeySource() === "dev") {
    console.error("REFUSING --apply: the current env resolves to the DEV-ONLY fallback key");
    console.error("(no SSN_ENCRYPTION_KEY and no JWT secret visible to this process).");
    console.error("Mass-encrypting production rows under a dev key would be destructive.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

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
    console.log("Nothing to do — no encrypted rows exist yet (run the backfill first).");
    await prisma.$disconnect();
    return;
  }

  const underCandidate: Record<string, number> = {};
  let migratable = 0;
  let migrated = 0;
  let refused = 0;
  let unknown = 0;

  for (const r of rows) {
    const tag = `${r.id} ${r.user?.email ?? "(no email)"}`;
    const cls = classifyEncryptedSsn(r.ssnEncrypted as string);

    if (cls === "UNDECRYPTABLE") {
      unknown++;
      console.log(`UNDECRYPTABLE under every known key: ${tag}`);
      continue;
    }

    underCandidate[cls.candidate] = (underCandidate[cls.candidate] ?? 0) + 1;

    if (cls.candidate === "current-env") {
      continue; // already under the key the app resolves — nothing to do
    }

    migratable++;
    console.log(
      `${apply ? "MIGRATING" : "WOULD MIGRATE"}: ${tag} written under ${cls.candidate} -> current key (${maskSsn(cls.plaintext)})`,
    );

    if (!apply) continue;

    const plan = buildSsnRekeyUpdate(cls.plaintext, cls.candidate, r.ssnLastFour);
    if (!plan.ok) {
      refused++;
      console.log(`  REFUSED (${plan.reason}${plan.detail ? `: ${plan.detail}` : ""}) — row untouched`);
      continue;
    }

    await prisma.driver.update({
      where: { id: r.id },
      data: { ssnEncrypted: plan.newEncrypted },
    });
    migrated++;
  }

  console.log("");
  console.log("Rows by identified key source:");
  for (const candidate of candidateProbeOrder()) {
    if (underCandidate[candidate]) console.log(`  ${candidate}: ${underCandidate[candidate]}`);
  }
  console.log(
    `Summary: ${migrated} migrated | ${migratable - migrated} not migrated${refused ? ` (${refused} refused by verification guards)` : ""} | ${unknown} undecryptable | ${rows.length - migratable - unknown} already current`,
  );
  console.log("");

  if (unknown > 0) {
    console.log(
      "UNDECRYPTABLE rows were written under a key that is not available in this environment.",
    );
    console.log(
      "If you used a DIFFERENT SSN_ENCRYPTION_KEY text at some point, put THAT text into",
      "OLD_SSN_ENCRYPTION_KEY (in .env or the shell — never a CLI argument) and re-run;",
      "this script will migrate those rows to your current key. If the original text is",
      "truly lost, those rows cannot be decrypted by anyone.",
    );
  }
  if (apply && migrated > 0) {
    console.log("NEXT STEPS:");
    console.log("  1. RESTART the backend app now so the running process uses the same key as the data.");
    console.log("  2. Run: npx ts-node scripts/backfill-driver-ssn-encrypted.ts --verify  (expect 100% OK)");
    console.log("  3. Test one reveal in the admin panel (an AdminAuditLog row is written per reveal).");
  }
  if (!apply && migratable > 0) {
    console.log("Re-run with --apply when the SSN_ENCRYPTION_KEY in .env is the FINAL text you intend to keep.");
  }
  if (migratable === 0 && unknown === 0) {
    console.log("Every encrypted row already uses the current key — the reveal error you saw should be gone after an app RESTART.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
