// scripts/backfill-driver-zips.ts
//
// STANDALONE one-time backfill: recovers driver ZIP codes that ended up
// stored under a different field name, and copies them into
// Driver.residentialZip — the single field the admin detail page, the
// admin driver list, and the admin ZIP filters all read.
//
// WHY: the signup form's "Home ZIP Code" was silently dropped by the
// backend for a long time (fixed in commit cd4518c), so drivers who
// registered never had a ZIP saved. Separately, the driver Preferences
// page ("Primary ZIP Code" field) has always saved its value into
// preferences.city — not residentialZip — so drivers who set it there
// DO have a recoverable ZIP sitting in another field.
//
// SOURCE COLUMN (the only one in the whole DB that holds ZIP-like data
// under a different name):
//   - DriverPreference.city  ("Primary ZIP Code" on /driver preferences)
//     A 5-digit value there is treated as a ZIP. Actual city names
//     ("Los Angeles") never match the 5-digit pattern and are ignored.
//
// SAFE by design:
//   - Only touches Driver.residentialZip. Never modifies
//     preferences.city (the source is left exactly as it was).
//   - Only fills drivers whose residentialZip is currently empty (null
//     or blank). Never overwrites an existing ZIP; conflicting rows are
//     listed as "skipped" so you can review them by hand.
//   - Only copies values that are EXACTLY 5 digits.
//   - Default mode is a DRY RUN: it prints exactly what would change.
//   - Pass --apply to actually write.
//
// Usage (from the backend folder):
//   npx ts-node scripts/backfill-driver-zips.ts            # dry run
//   npx ts-node scripts/backfill-driver-zips.ts --apply    # write
//
// Requires DATABASE_URL (loaded automatically from backend/.env).

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const ZIP_RE = /^\d{5}$/;

interface DriverRow {
  id: string;
  residentialZip: string | null;
  user: { email: string; fullName: string | null } | null;
  preferences: { city: string | null } | null;
}

async function main(): Promise<void> {
  dotenv.config();

  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  try {
    const drivers = (await prisma.driver.findMany({
      where: { preferences: { isNot: null } },
      select: {
        id: true,
        residentialZip: true,
        user: { select: { email: true, fullName: true } },
        preferences: { select: { city: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as DriverRow[];

    const toBackfill: { row: DriverRow; zip: string }[] = [];
    const skippedHasZip: string[] = [];
    const noCandidate: string[] = [];

    for (const row of drivers) {
      const candidate = (row.preferences?.city ?? "").trim();
      const hasZip = !!(row.residentialZip ?? "").trim();

      if (!ZIP_RE.test(candidate)) {
        // preferences.city is empty or a real city name — nothing to do
        if (!hasZip) noCandidate.push(row.id);
        continue;
      }

      if (hasZip) {
        if (row.residentialZip!.trim() !== candidate) {
          skippedHasZip.push(
            `${row.id} (${row.user?.email ?? "no email"}): has ` +
              `${row.residentialZip!.trim()}, preferences.city says ${candidate} — kept existing`,
          );
        }
        continue;
      }

      toBackfill.push({ row, zip: candidate });
    }

    console.log("=".repeat(72));
    console.log("Driver ZIP backfill (preferences.city -> residentialZip)");
    console.log("=".repeat(72));
    console.log(`Drivers scanned (with preferences):        ${drivers.length}`);
    console.log(`Already have residentialZip:               ${drivers.length - toBackfill.length - noCandidate.length}`);
    console.log(`Will backfill (empty ZIP + 5-digit city):  ${toBackfill.length}`);
    console.log(`No ZIP and no recoverable value:           ${noCandidate.length}`);
    console.log(`Skipped (has ZIP, prefs differ):           ${skippedHasZip.length}`);

    if (toBackfill.length > 0) {
      console.log("\nWould set residentialZip for:");
      for (const { row, zip } of toBackfill) {
        console.log(
          `  ${row.id}  ${zip}  ${row.user?.email ?? "(no email)"}  ` +
            `${row.user?.fullName ?? "(no name)"}`,
        );
      }
    }

    if (skippedHasZip.length > 0) {
      console.log("\nSkipped (already has a ZIP — review manually if needed):");
      for (const line of skippedHasZip) console.log(`  ${line}`);
    }

    if (!apply) {
      console.log(
        `\nDRY RUN — nothing written. Re-run with --apply to write ` +
          `${toBackfill.length} residentialZip value(s).`,
      );
      return;
    }

    if (toBackfill.length === 0) {
      console.log("\nNothing to write.");
      return;
    }

    let updated = 0;
    for (const { row, zip } of toBackfill) {
      const res = await prisma.driver.updateMany({
        where: {
          id: row.id,
          // Guard against racing with onboarding/admin edits: only fill
          // if it is still empty at write time. Never overwrite.
          OR: [{ residentialZip: null }, { residentialZip: "" }],
        },
        data: { residentialZip: zip },
      });
      updated += res.count;
    }

    console.log(`\nAPPLIED — ${updated} driver(s) updated.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
