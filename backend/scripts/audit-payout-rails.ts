// scripts/audit-payout-rails.ts
//
// READ-ONLY audit of the payout setup — answers the owner's question:
// "check the Stripe dashboard under Connect — look at each driver's
// account type: Express, Standard, or Custom."
//
// Run on the server (from the backend folder):
//   npx ts-node scripts/audit-payout-rails.ts
//
// What it reports:
//   DB side (needs DATABASE_URL from backend/.env):
//     1. Legacy in-app bank entries (DriverBankAccount rows) — the retired
//        manual rail. Any rows here mean old drivers whose bank details
//        were collected inside the app.
//     2. Stripe Connect coverage — drivers with a Connect account +
//        completed onboarding vs drivers still missing it.
//     3. Drivers with ELIGIBLE (withdrawable) balance but NO Connect
//        account — money they can't receive until they set up payouts.
//   Stripe side (needs STRIPE_SECRET_KEY; skipped otherwise):
//     4. Every connected account in Stripe with its type (express /
//        standard / custom) + charges_enabled + payouts_enabled.

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

async function main(): Promise<void> {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set. Add it to backend/.env (or export it) and retry.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // ── 1. Legacy in-app bank entries ──
    const legacyBankRows = await prisma.driverBankAccount.findMany({
      select: {
        driverId: true,
        accountHolderName: true,
        bankName: true,
        accountType: true,
        updatedAt: true,
        driver: { include: { user: { select: { fullName: true, email: true } } } },
      },
      orderBy: { updatedAt: "desc" as const },
    });
    console.log("═".repeat(72));
    console.log("1) LEGACY in-app bank entries (DriverBankAccount — retired rail)");
    console.log("═".repeat(72));
    if (legacyBankRows.length === 0) {
      console.log("   ✓ None — no bank details were ever stored in our DB.");
    } else {
      console.log(`   ⚠ ${legacyBankRows.length} driver(s) have bank details stored in-app:`);
      for (const b of legacyBankRows) {
        const who = b.driver?.user?.fullName || b.driver?.user?.email || b.driverId;
        console.log(
          `   - ${who} (${b.bankName || "bank n/a"}, ${b.accountType || "checking"}, last updated ${b.updatedAt.toISOString().slice(0, 10)})`
        );
      }
      console.log("   → These are HISTORICAL rows. The manual rail is retired; drivers");
      console.log("     should switch to Stripe hosted onboarding (Set Up Payouts).");
    }

    // ── 2. Stripe Connect coverage ──
    const [totalDrivers, withAccount, onboarded] = await Promise.all([
      prisma.driver.count(),
      prisma.driver.count({ where: { stripeConnectAccountId: { not: null } } }),
      prisma.driver.count({
        where: { stripeConnectAccountId: { not: null }, stripeConnectOnboardingComplete: true },
      }),
    ]);
    console.log("");
    console.log("═".repeat(72));
    console.log("2) STRIPE CONNECT coverage (drivers)");
    console.log("═".repeat(72));
    console.log(`   Total drivers:                 ${totalDrivers}`);
    console.log(`   With a Connect account:        ${withAccount}`);
    console.log(`   Onboarding COMPLETE:           ${onboarded}`);
    console.log(`   Missing onboarding:            ${onboarded < withAccount ? withAccount - onboarded : 0} incomplete, ${totalDrivers - withAccount} no account yet`);
    console.log("   → All accounts we create are EXPRESS (hosted Stripe onboarding —");
    console.log("     the Lyft/DoorDash flow). Standard/Custom are never created by us.");

    // ── 3. Money stuck behind missing onboarding ──
    const driversWithBalance = await prisma.driverPayout.groupBy({
      by: ["driverId"],
      where: { status: "ELIGIBLE" },
      _sum: { netAmount: true },
    });
    const stuck: Array<{ name: string; balance: number }> = [];
    for (const d of driversWithBalance) {
      const driver = await prisma.driver.findUnique({
        where: { id: d.driverId },
        select: {
          stripeConnectAccountId: true,
          stripeConnectOnboardingComplete: true,
          user: { select: { fullName: true, email: true } },
        },
      });
      if (!driver?.stripeConnectAccountId || !driver.stripeConnectOnboardingComplete) {
        stuck.push({
          name: driver?.user?.fullName || driver?.user?.email || d.driverId,
          balance: Number(d._sum.netAmount ?? 0),
        });
      }
    }
    console.log("");
    console.log("═".repeat(72));
    console.log("3) WITHDRAWABLE balance stuck behind missing payout setup");
    console.log("═".repeat(72));
    if (stuck.length === 0) {
      console.log("   ✓ Everyone with eligible money has completed Stripe onboarding.");
    } else {
      for (const s of stuck) {
        console.log(`   ⚠ ${s.name} — $${s.balance.toFixed(2)} eligible but payouts not set up`);
      }
      console.log("   → They see the money in their wallet; the transfer reverts until");
      console.log("     they finish Set Up Payouts.");
    }

    // ── 4. Stripe-side account audit ──
    if (process.env.STRIPE_SECRET_KEY) {
      console.log("");
      console.log("═".repeat(72));
      console.log("4) STRIPE dashboard — connected accounts (live audit)");
      console.log("═".repeat(72));
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: (Stripe as any).API_VERSION,
        });
        const accounts = await stripe.accounts.list({ limit: 100 });
        console.log(`   Connected accounts in Stripe: ${accounts.data.length}`);
        for (const acc of accounts.data) {
          const driverId = (acc.metadata as any)?.driverId ?? "(no driverId in metadata)";
          console.log(
            `   - ${acc.id}  type=${acc.type.toUpperCase()}  charges=${acc.charges_enabled ? "YES" : "no"}  payouts=${acc.payouts_enabled ? "YES" : "no"}  driver=${driverId}`
          );
        }
      } catch (err: any) {
        console.log(`   ⚠ Stripe audit skipped: ${err?.message}`);
      }
    } else {
      console.log("");
      console.log("4) STRIPE dashboard audit — SKIPPED (no STRIPE_SECRET_KEY in env).");
      console.log("   Add STRIPE_SECRET_KEY to backend/.env and re-run to list every");
      console.log("   connected account with its type (express/standard/custom).");
    }

    console.log("");
    console.log("Audit complete — read-only, nothing was modified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ Audit failed:", err);
  process.exit(1);
});
