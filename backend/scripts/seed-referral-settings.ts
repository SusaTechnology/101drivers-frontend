// scripts/seed-referral-settings.ts
//
// STANDALONE seeder for the referral program settings ONLY — the money
// amounts, the who-can-refer-whom matrix, and the program toggles.
// Touches NOTHING else (no users, no demo data). Safe to run on a live
// database.
//
// Usage (from the backend folder):
//   npx ts-node scripts/seed-referral-settings.ts            # SAFE: only writes if the row does not exist yet
//   npx ts-node scripts/seed-referral-settings.ts --force    # OVERWRITE the existing row with defaults (admin edits lost!)
//
// Requires DATABASE_URL (loaded automatically from backend/.env).
//
// What it writes (key: REFERRAL_PROGRAM_SETTINGS):
//   - Money: driver $5/paid delivery to referrer + $50 one-shot bonus to
//     the referred driver on their 5th paid delivery (within 30 days of
//     signup) · business $10 one-time ($300 rolling 30-day cap) ·
//     personal $5 one-time (no cap)
//   - Who-can-refer-whom matrix (drivers/personal cannot refer
//     businesses; business referrers can refer everyone)
//   - Program active + driver/customer referral toggles
//
// After seeding, admins edit everything on Admin → Referral Program;
// the values live in the DB, not in code.

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { defaultReferralProgramSettings } from "../src/appSetting/referral-program-defaults";

const KEY = "REFERRAL_PROGRAM_SETTINGS";

function cents(n: number): string {
  return `$${(n / 100).toFixed(2)}`;
}

function ordinal(n: number): string {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

function printSummary(s: ReturnType<typeof defaultReferralProgramSettings>): void {
  console.log("─".repeat(64));
  console.log("Referral program settings that will be written:");
  console.log("─".repeat(64));
  console.log(`Program active:                          ${s.isActive ? "yes" : "no"}`);
  console.log(`Payout model:                            ${s.payoutModel}`);
  console.log(`Driver referral — referrer earns:        ${cents(s.perDeliveryReferrerAmountCents)} per paid delivery`);
  console.log(
    `Driver referral — referred driver bonus: ${cents(s.perDeliveryReferredBonusCents)} one-shot on the ${ordinal(
      s.perDeliveryBonusTriggerCount
    )} paid delivery`
  );
  console.log(`Driver referral — payout window:         ${s.referralWindowDays} days from signup`);
  console.log(
    `Business referral — one-time:            ${cents(s.businessReferralAmountCents)} (rolling cap ${cents(
      s.businessReferralRollingCapCents
    )} / 30 days)`
  );
  console.log(`Personal referral — one-time:            ${cents(s.residentialReferralAmountCents)} (no cap)`);
  console.log(`Driver referrer flow enabled:            ${s.driverReferralsEnabled ? "yes" : "no"}`);
  console.log(`Customer referrer flow enabled:          ${s.customerReferralsEnabled ? "yes" : "no"}`);
  console.log("Who can refer whom (matrix):");
  const roles = ["DRIVER", "PERSONAL", "BUSINESS"] as const;
  for (const role of roles) {
    const row = s.referralRoleMatrix[role];
    console.log(
      `  ${role.padEnd(8)} → driver: ${row.DRIVER ? "YES" : "no "}   personal: ${row.PERSONAL ? "YES" : "no "}   business: ${row.BUSINESS ? "YES" : "no "}`
    );
  }
  console.log("─".repeat(64));
}

async function main(): Promise<void> {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set. Add it to backend/.env (or export it) and retry.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const defaults = defaultReferralProgramSettings();
    printSummary(defaults);

    const force = process.argv.includes("--force");
    const existing = await prisma.appSetting.findUnique({
      where: { key: KEY },
      select: { key: true },
    });

    if (existing && !force) {
      console.log(`✓ Row "${KEY}" already exists — LEFT UNTOUCHED (admin edits preserved).`);
      console.log("  To overwrite it with the defaults above, re-run with --force.");
      return;
    }

    if (existing && force) {
      await prisma.appSetting.update({
        where: { key: KEY },
        data: { value: defaults as any },
      });
      console.log(`✓ OVERWROTE "${KEY}" with the defaults shown above (--force).`);
      return;
    }

    await prisma.appSetting.create({
      data: { key: KEY, value: defaults as any },
    });
    console.log(`✓ Seeded "${KEY}" with the defaults shown above.`);
    console.log("  Admins can now see and edit everything on Admin → Referral Program.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
