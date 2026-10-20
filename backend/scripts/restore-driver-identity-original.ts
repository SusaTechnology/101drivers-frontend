// scripts/restore-driver-identity-original.ts
//
// ONE-TIME REPAIR for databases that ran the ORIGINAL (pre-25afdbab) version
// of migration 20261020090000_driver_identity_uniqueness — the version whose
// backfill UPDATEs modified existing rows.
//
// WHAT THE OLD MIGRATION DID TO EXISTING ROWS (exactly what this undoes):
//   For every Driver whose ssnLastFour held a full 9-digit SSN it wrote:
//     ssnHash      = hex(HMAC-SHA256(full9, key='101drivers-identity-hash-v1'))
//     ssnLastFour  = right(full9, 4)               <- the destructive part
//   And for every onboarded driver it wrote:
//     licenseNumberHash = hex(HMAC(upper(alnum(licenseNumber)) + ':' + state))
//   (licenseNumber / licenseState / all other columns were NEVER modified.)
//
// WHY RECOVERY IS GUARANTEED: the stored hash is deterministic over the FULL
// 9 digits and the last 4 digits are still on the row — only the first 5
// digits are unknown, a 100,000-combination space. This script brute-forces
// the first 5 digits against the stored HMAC. An HMAC-SHA256 match
// mathematically identifies the original SSN — no false positives.
//
// WHAT IT WRITES (--apply only), per recovered row — the exact pre-migration
// state, as if the backfill never ran:
//     ssnLastFour       = the recovered full 9 digits
//     ssnHash           = NULL      (column did not exist before the migration)
//     licenseNumberHash = NULL      (column did not exist before the migration)
//
// SAFETY RAILS:
//   - DRY RUN BY DEFAULT: prints what it WOULD restore (SSN masked), writes
//     nothing. Add --apply to write.
//   - A row is written ONLY when the HMAC match is found. No match = row left
//     completely untouched and reported (should never happen).
//   - Rows the FIXED app wrote after your deploy also carry hashes — but for
//     those rows ssnLastFour was ALWAYS the last 4 (never truncated), so they
//     must NOT be restored. Exclude them with --cutoff <ISO>: rows with
//     updatedAt >= cutoff are reported and skipped. Example:
//       --cutoff "2026-10-21T00:00:00Z"   (the moment you deployed / migrated)
//     Omit --cutoff ONLY if no driver signed up or re-saved since deploy.
//   - Rows that the old migration did NOT touch (ssnLastFour was not a clean
//     9 digits) have ssnHash NULL and are never in scope.
//
// USAGE (on the server, from backend/):
//   npx ts-node scripts/restore-driver-identity-original.ts
//   npx ts-node scripts/restore-driver-identity-original.ts --apply --cutoff "2026-10-21T00:00:00Z"

import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";

const prisma = new PrismaClient();

// The old migration used this LITERAL pepper (it could not read env vars).
const MIGRATION_PEPPER = "101drivers-identity-hash-v1";
// The app may have been configured with its own pepper for rows written by
// the fixed app — tried as a fallback only (those rows are normally excluded
// by --cutoff anyway).
const APP_PEPPER = process.env.IDENTITY_HASH_PEPPER || MIGRATION_PEPPER;

function hmacHex(value: string, pepper: string): string {
  return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}

/** Recover the full 9-digit SSN from its HMAC + the surviving last 4 digits. */
function recoverFullSsn(lastFour: string, storedHash: string): { full: string; pepper: string } | null {
  for (let n = 0; n < 100000; n++) {
    const prefix = String(n).padStart(5, "0");
    const candidate = prefix + lastFour;
    if (hmacHex(candidate, MIGRATION_PEPPER) === storedHash) return { full: candidate, pepper: "migration" };
    if (APP_PEPPER !== MIGRATION_PEPPER && hmacHex(candidate, APP_PEPPER) === storedHash) {
      return { full: candidate, pepper: "app" };
    }
  }
  return null;
}

function maskSsn(full: string): string {
  return full.slice(0, 2) + "•" + "•" + "•" + "•" + "•" + full.slice(5);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const cutoffIdx = args.indexOf("--cutoff");
  const cutoff = cutoffIdx !== -1 && args[cutoffIdx + 1] ? new Date(args[cutoffIdx + 1]) : null;
  if (cutoffIdx !== -1 && (!cutoff || isNaN(cutoff.getTime()))) {
    console.error("FATAL: --cutoff must be a valid ISO timestamp, e.g. \"2026-10-21T00:00:00Z\"");
    process.exit(1);
  }

  console.log(`Mode: ${apply ? "APPLY — rows WILL be written" : "DRY RUN — nothing is written"}`);
  console.log(`Cutoff: ${cutoff ? cutoff.toISOString() : "(none — ALL hashed rows are in scope)"}`);
  console.log("");

  const rows = await prisma.driver.findMany({
    where: { ssnHash: { not: null } },
    select: {
      id: true, email: true, ssnLastFour: true, ssnHash: true,
      licenseNumberHash: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("No rows with ssnHash found — nothing to restore. Database is already in the pre-migration state (or the zero-touch migration was the only one ever run).");
    return;
  }

  let restored = 0, skippedPostDeploy = 0, failed = 0, anomalous = 0;

  for (const r of rows) {
    const tag = `${r.id} ${r.email ?? "(no email)"} (updated ${r.updatedAt.toISOString()})`;

    // Post-deploy app-written row: ssnLastFour was never truncated — leave it.
    if (cutoff && r.updatedAt >= cutoff) {
      skippedPostDeploy++;
      console.log(`SKIP (written after cutoff — app row, not migration damage): ${tag}`);
      continue;
    }

    if (!r.ssnLastFour || !/^\d{4}$/.test(r.ssnLastFour) || !r.ssnHash) {
      anomalous++;
      console.log(`ANOMALY — hash present but ssnLastFour is not 4 digits, untouched: ${tag}`);
      continue;
    }

    const found = recoverFullSsn(r.ssnLastFour, r.ssnHash);
    if (!found) {
      failed++;
      console.log(`FAILED — no HMAC match (check IDENTITY_HASH_PEPPER), untouched: ${tag}`);
      continue;
    }

    if (found.pepper === "app") {
      skippedPostDeploy++;
      console.log(`SKIP (hash matches APP pepper — written by the fixed app, not migration damage): ${tag} stored=${maskSsn(found.full)}`);
      continue;
    }

    console.log(`${apply ? "RESTORED" : "WOULD RESTORE"}: ${tag} ssnLastFour ${r.ssnLastFour} -> ${maskSsn(found.full)}; ssnHash/licHash -> NULL`);

    if (apply) {
      await prisma.driver.update({
        where: { id: r.id },
        data: { ssnLastFour: found.full, ssnHash: null, licenseNumberHash: null },
      });
    }
    restored++;
  }

  console.log("");
  console.log(`Summary: ${restored} ${apply ? "restored" : "would restore"} | ${skippedPostDeploy} skipped (post-deploy app rows) | ${failed} failed (untouched) | ${anomalous} anomalous (untouched)`);
  if (!apply && restored > 0) {
    console.log("Re-run with --apply (and --cutoff if any driver signed up since your deploy) to write the restoration.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
