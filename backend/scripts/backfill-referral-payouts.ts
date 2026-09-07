// scripts/backfill-referral-payouts.ts
//
// STANDALONE one-time backfill: flips existing referral payout rows
// (DriverPayout type REFERRAL_REFERRER / REFERRAL_REFERRED) from PENDING
// to ELIGIBLE so they land in the driver's available balance and are paid
// out via the standard payout rail (withdrawal / instant / weekly batch →
// Stripe Connect transfer).
//
// WHY: before the born-ELIGIBLE change, referral payouts were created as
// PENDING and nothing ever moved them out — the money was recorded but
// stuck. This script pays out what drivers already earned.
//
// SAFE by design:
//   - Touches ONLY DriverPayout rows of type REFERRAL_REFERRER /
//     REFERRAL_REFERRED in status PENDING. Never touches delivery payouts
//     (TRIP_COMPLETION, LOCK_IN_FEE), never touches money amounts.
//   - Default mode is a DRY RUN: it prints exactly what would change.
//   - Pass --apply to actually write.
//
// Usage (from the backend folder):
//   npx ts-node scripts/backfill-referral-payouts.ts            # dry run
//   npx ts-node scripts/backfill-referral-payouts.ts --apply    # write
//
// Requires DATABASE_URL (loaded automatically from backend/.env).

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

async function main(): Promise<void> {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set. Add it to backend/.env (or export it) and retry.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const apply = process.argv.includes("--apply");

  try {
    const pending = await prisma.driverPayout.findMany({
      where: {
        type: { in: ["REFERRAL_REFERRER", "REFERRAL_REFERRED"] },
        status: "PENDING",
      },
      select: {
        id: true,
        driverId: true,
        type: true,
        grossAmount: true,
        netAmount: true,
        createdAt: true,
        failureMessage: true,
        driver: { include: { user: { select: { fullName: true, email: true } } } },
      },
      orderBy: { createdAt: "asc" as const },
    });

    console.log("─".repeat(72));
    console.log(
      `Referral payouts currently PENDING (stuck): ${pending.length}` +
        (pending.length === 0 ? " — nothing to do." : "")
    );
    if (pending.length > 0) {
      console.log("─".repeat(72));
      let totalDollars = 0;
      for (const p of pending) {
        const who = p.driver?.user?.fullName || p.driver?.user?.email || p.driverId;
        console.log(
          `  ${p.createdAt.toISOString().slice(0, 10)}  ${p.type.padEnd(18)} $${Number(p.netAmount).toFixed(2).padStart(7)}  ${who}  (${p.id})`
        );
        totalDollars += Number(p.netAmount);
      }
      console.log("─".repeat(72));
      console.log(`Total owed to drivers: $${totalDollars.toFixed(2)}`);
    }

    if (!apply) {
      console.log("");
      console.log("DRY RUN — nothing written. Re-run with --apply to flip these rows to ELIGIBLE.");
      return;
    }

    const result = await prisma.driverPayout.updateMany({
      where: {
        type: { in: ["REFERRAL_REFERRER", "REFERRAL_REFERRED"] },
        status: "PENDING",
      },
      data: { status: "ELIGIBLE" },
    });

    console.log("");
    console.log(`✓ Backfilled ${result.count} referral payout(s) PENDING → ELIGIBLE.`);
    console.log("  Drivers can now see the money in their available balance and cash out");
    console.log("  from the wallet (free withdrawal / instant payout).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ Backfill failed:", err);
  process.exit(1);
});
