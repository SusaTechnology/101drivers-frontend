// scripts/admin-gate-key.ts — print the current admin-gate access keys.
//
// The admin UI is behind a shared-secret door: anyone opening an /admin*
// URL without a valid gate cookie is bounced to the landing page. The
// door opens via a link like:
//
//   https://101drivers.com/admin-dashboard?key=<KEY>
//
// The key is derived from ADMIN_GATE_SECRET (falls back to JWT_SECRET)
// and the month, so it ROTATES BY ITSELF every month — no cron, no DB.
// Run this on the server whenever you need to (re)share the link:
//
//   npm run admin-gate:key

import * as dotenv from "dotenv";

import { AdminGateService } from "../src/admin-gate/admin-gate.service";

function stampOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  dotenv.config();

  const service = new AdminGateService();
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  try {
    const current = service.monthKey();
    const upcoming = service.monthKey(stampOf(next));
    const previous = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );

    console.log(`\n🔑 Admin gate keys (secret: ${
      process.env.ADMIN_GATE_SECRET ? "ADMIN_GATE_SECRET" : "JWT_SECRET"
    })\n`);
    console.log(`   Current  ${stampOf(now)}  : ${current}`);
    console.log(`   Next     ${stampOf(next)}  : ${upcoming}  (starts working on the 1st)`);
    console.log(
      `   Previous ${stampOf(previous)}  : still accepted until midnight UTC (rollover grace)\n`
    );
    console.log(`   Share:    https://101drivers.com/admin-dashboard?key=${current}\n`);
    console.log(`   Kill switch: change ADMIN_GATE_SECRET in the server env — every`);
    console.log(`   key and every cookie dies instantly.\n`);
  } catch (error) {
    console.error(
      "✗ No gate secret configured — set ADMIN_GATE_SECRET (or JWT_SECRET) in the env.",
      (error as Error).message
    );
    process.exit(1);
  }
}

main();
