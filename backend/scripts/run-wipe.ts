/**
 * run-wipe.ts — one-command "start from zero" DB wipe, same UX as
 * stripe-wipe-billing.ts. No psql / docker knowledge needed.
 *
 * WHAT IT DOES:
 *   1. Pre-check — prints row counts + a money check (any PAID/CAPTURED?).
 *   2. BACKUP — saves every row it is about to delete into a timestamped
 *      JSON file (backend/wipe-backup-<date>.json). This is your undo file.
 *   3. WIPES — all deliveries + everything attached, all payments/payouts,
 *      referrals + credits, notifications/audit/support, quotes; resets
 *      every dealer's billing flags to factory-prepaid. ONE transaction:
 *      if anything fails, NOTHING is deleted.
 *   4. VERIFIES — prints the all-zeros table. Every dealer keeps their
 *      account, saved card, and pricing-config assignment.
 *
 * KEEPS: users/logins, dealer accounts, drivers, saved cards, pricing
 * configs + per-dealer pricing assignment, schedules, app settings,
 * referral codes, and (by default) driver Stripe Connect linkage.
 *
 * ⚠️  BEFORE YOU RUN: stop the backend (its crons must not run mid-wipe).
 * ⚠️  Run stripe-wipe-billing.ts too — DB wipe alone does not clear Stripe
 *     (your live account already scanned clean, so you likely only need
 *     this script).
 *
 * USAGE (from the backend folder):
 *   npx ts-node scripts/run-wipe.ts                # dry run — REPORT ONLY
 *   npx ts-node scripts/run-wipe.ts --apply        # backup + wipe
 *   npx ts-node scripts/run-wipe.ts --apply --reset-driver-connect
 *       # ALSO clears driver Stripe Connect linkage (pair with
 *       # stripe-wipe-billing.ts --also-delete-connect-accounts — both or neither)
 */

import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const RESET_CONNECT = process.argv.includes("--reset-driver-connect");

const prisma = new PrismaClient();

// Order matters: children before parents (FK-safe). Keep in sync with
// scripts/wipe-transactional-data.sql.
const STATEMENTS: string[] = [
  `UPDATE "DeliveryRequest" SET "resubmittedFromId" = NULL`,
  `DELETE FROM "DriverRouteCache"`,
  `DELETE FROM "TrackingPoint"`,
  `DELETE FROM "TrackingSession"`,
  `DELETE FROM "DisputeNote"`,
  `DELETE FROM "DisputeCase"`,
  `DELETE FROM "DeliveryEvidence"`,
  `DELETE FROM "DeliveryCompliance"`,
  `DELETE FROM "EvidenceExport"`,
  `DELETE FROM "DeliveryStatusHistory"`,
  `DELETE FROM "ScheduleChangeRequest"`,
  `DELETE FROM "DeliveryRating"`,
  `DELETE FROM "Tip"`,
  `DELETE FROM "DeliveryAssignment"`,
  `DELETE FROM "ReferralCredit"`,
  `DELETE FROM "PaymentEvent"`,
  `DELETE FROM "DriverPayoutAdjustment"`,
  `DELETE FROM "PayoutBatchItem"`,
  `DELETE FROM "PayoutBatch"`,
  `DELETE FROM "Invoice"`,
  `DELETE FROM "Payment"`,
  `DELETE FROM "Referral"`,
  `DELETE FROM "DriverPayout"`,
  `DELETE FROM "DeliveryRequest"`,
  `DELETE FROM "Quote"`,
  `DELETE FROM "SupportRequestNote"`,
  `DELETE FROM "SupportRequest"`,
  `DELETE FROM "NotificationEvent"`,
  `DELETE FROM "AdminAuditLog"`,
  `UPDATE "Customer" SET "billingMode" = NULL, "postpaidEnabled" = false,
     "billingFrozen" = false, "billingFrozenAt" = NULL,
     "billingFrozenReason" = NULL, "stripeSubscriptionId" = NULL,
     "postpaidCreditLimitCents" = NULL, "updatedAt" = now()`,
];

if (RESET_CONNECT) {
  STATEMENTS.push(
    `UPDATE "Driver" SET "stripeConnectAccountId" = NULL,
       "stripeConnectOnboardingComplete" = false, "updatedAt" = now()`,
  );
}

// Every table that loses rows — backed up before delete.
const BACKUP_TABLES: Array<{ table: string; model: keyof PrismaClient }> = [
  { table: "DeliveryRequest", model: "deliveryRequest" },
  { table: "Quote", model: "quote" },
  { table: "Payment", model: "payment" },
  { table: "PaymentEvent", model: "paymentEvent" },
  { table: "Invoice", model: "invoice" },
  { table: "DriverPayout", model: "driverPayout" },
  { table: "DriverPayoutAdjustment", model: "driverPayoutAdjustment" },
  { table: "PayoutBatch", model: "payoutBatch" },
  { table: "PayoutBatchItem", model: "payoutBatchItem" },
  { table: "Referral", model: "referral" },
  { table: "ReferralCredit", model: "referralCredit" },
  { table: "DisputeCase", model: "disputeCase" },
  { table: "DisputeNote", model: "disputeNote" },
  { table: "DeliveryRating", model: "deliveryRating" },
  { table: "Tip", model: "tip" },
  { table: "TrackingSession", model: "trackingSession" },
  { table: "TrackingPoint", model: "trackingPoint" },
  { table: "DriverRouteCache", model: "driverRouteCache" },
  { table: "DeliveryEvidence", model: "deliveryEvidence" },
  { table: "DeliveryCompliance", model: "deliveryCompliance" },
  { table: "EvidenceExport", model: "evidenceExport" },
  { table: "DeliveryStatusHistory", model: "deliveryStatusHistory" },
  { table: "ScheduleChangeRequest", model: "scheduleChangeRequest" },
  { table: "DeliveryAssignment", model: "deliveryAssignment" },
  { table: "NotificationEvent", model: "notificationEvent" },
  { table: "AdminAuditLog", model: "adminAuditLog" },
  { table: "SupportRequest", model: "supportRequest" },
  { table: "SupportRequestNote", model: "supportRequestNote" },
];

const ROW_CAP = 100_000; // per-table safety cap for the backup file

async function count(table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*)::int AS c FROM "${table}"`,
  );
  return rows[0]?.c ?? 0;
}

async function main() {
  console.log(
    `Run mode: ${APPLY ? "APPLY — data WILL be deleted (backup saved first)" : "DRY RUN — report only (add --apply to wipe)"}`,
  );
  if (RESET_CONNECT)
    console.log(
      `Driver Connect reset: ${APPLY ? "INCLUDED" : "would be included"} (--reset-driver-connect)`,
    );

  // ------------------------------------------------ 1) pre-check
  console.log(`\n===== 1) PRE-CHECK — what exists today =====`);
  let totalRows = 0;
  const before: Record<string, number> = {};
  for (const { table } of BACKUP_TABLES) {
    const c = await count(table);
    before[table] = c;
    totalRows += c;
    if (c > 0) console.log(`   ${table.padEnd(26)} ${c}`);
  }
  if (totalRows === 0) console.log(`   (all wipe tables already empty)`);

  const money = await prisma.$queryRawUnsafe<
    { status: string; n: number; total: number }[]
  >(
    `SELECT status, COUNT(*)::int AS n, COALESCE(SUM(amount),0)::float AS total
     FROM "Payment" GROUP BY status ORDER BY status`,
  );
  console.log(`\n   Money check (Payment rows by status):`);
  for (const m of money)
    console.log(
      `     ${m.status.padEnd(18)} ${String(m.n).padStart(4)}  $${m.total.toFixed(2)}`,
    );
  const liveMoney = money
    .filter((m) => ["CAPTURED", "PAID"].includes(m.status) && m.total > 0)
    .reduce((s, m) => s + m.total, 0);
  if (liveMoney > 0)
    console.log(
      `   ⚠️  $${liveMoney.toFixed(2)} shows as CAPTURED/PAID. Deleting rows does NOT refund — if these are real (live-key) charges, refund in Stripe first.`,
    );

  // ------------------------------------------------ 2) backup
  let backupFile = "(dry run — no backup written)";
  if (APPLY && totalRows > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    backupFile = `wipe-backup-${stamp}.json`;
    console.log(`\n===== 2) BACKUP → ${backupFile} =====`);
    const dump: Record<string, unknown[]> = {};
    for (const { table, model } of BACKUP_TABLES) {
      if (before[table] === 0) continue;
      const rows = await (prisma[model] as any).findMany({
        take: ROW_CAP,
      });
      if (rows.length >= ROW_CAP)
        console.log(
          `   ⚠️ ${table} hit the ${ROW_CAP}-row backup cap — larger tables were not fully saved!`,
        );
      dump[table] = rows;
    }
    fs.writeFileSync(backupFile, JSON.stringify(dump, null, 1));
    const bytes = fs.statSync(backupFile).size;
    console.log(
      `   saved (${(bytes / 1024 / 1024).toFixed(1)} MB) — keep this file until go-live is stable`,
    );
  }

  // ------------------------------------------------ 3) wipe (one transaction)
  console.log(
    `\n===== 3) WIPE — ${APPLY ? "EXECUTING" : "would execute"} ${STATEMENTS.length} statements in ONE transaction =====`,
  );
  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      for (const sql of STATEMENTS) {
        const n = await tx.$executeRawUnsafe(sql);
        const label = sql.slice(0, 46).replace(/\s+/g, " ");
        console.log(`   ✓ ${String(n).padStart(6)} rows  ${label}…`);
      }
      // ------------------------------------------ 4) verify INSIDE the tx
      console.log(`\n===== 4) VERIFY (must all be 0) =====`);
      let bad = 0;
      for (const { table } of BACKUP_TABLES) {
        const rows = await tx.$queryRawUnsafe<{ c: number }[]>(
          `SELECT COUNT(*)::int AS c FROM "${table}"`,
        );
        if ((rows[0]?.c ?? 0) !== 0) {
          bad++;
          console.log(`   ✗ ${table} still has ${rows[0].c} rows!`);
        }
      }
      const postpaid = await tx.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*)::int AS c FROM "Customer"
         WHERE "billingMode" IS NOT NULL OR "postpaidEnabled" = true
            OR "billingFrozen" = true OR "stripeSubscriptionId" IS NOT NULL`,
      );
      const postpaidN = postpaid[0]?.c ?? 0;
      if (postpaidN !== 0) {
        bad++;
        console.log(`   ✗ ${postpaidN} dealers still on postpaid!`);
      }
      if (bad > 0) throw new Error(`verification failed — rolling back`);
      console.log(`   ✓ all wiped tables are 0, no dealer on postpaid`);
    });
  } else {
    console.log(`   (statements shown in scripts/run-wipe.ts source)`);
  }

  // ------------------------------------------------ 5) what survived
  const kept = await Promise.all([
    count("Customer"),
    prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM "Customer" WHERE "stripeDefaultPaymentMethodId" IS NOT NULL`,
    ),
    count("PricingConfig"),
    count("User"),
    count("Driver"),
  ]);
  console.log(`\n===== KEPT (your starting point) =====`);
  console.log(`   Dealers (accounts)        : ${kept[0]}`);
  console.log(`   Dealers with saved card   : ${kept[1][0]?.c ?? 0}`);
  console.log(`   Pricing configs           : ${kept[2]}`);
  console.log(`   Users (logins)            : ${kept[3]}`);
  console.log(`   Drivers                   : ${kept[4]}`);

  console.log(`\nBackup file: ${backupFile}`);
  if (!APPLY) {
    console.log(`\nThis was a DRY RUN — nothing was changed.`);
    console.log(`Re-run with --apply to execute (backup is saved automatically).`);
  } else {
    console.log(
      `\n✅ Database is at zero. Start the backend and check a dealer panel:`,
    );
    console.log(`   - $0.00 outstanding, $0.00 next charge, no amber block`);
    console.log(`   - Stripe side: your earlier dry run showed LIVE is already clean`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Wipe failed — transaction rolled back, NOTHING deleted.");
    console.error("Error:", err?.message ?? err);
    console.error("Fix the problem and re-run (it is safe to re-run).");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
