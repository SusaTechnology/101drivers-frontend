// scripts/backfill-driver-zips.ts
//
// STANDALONE one-time fill: gives every driver without a ZIP a value in
// Driver.residentialZip — the single field the admin detail page, the
// admin driver list, and the admin ZIP filters all read.
//
// WHY: the signup form's "Home ZIP Code" was silently dropped by the
// backend for a long time (fixed in commit cd4518c), so drivers who
// registered never had a ZIP saved. This script fills those gaps using
// the best data available, in this order (first match wins):
//
//   1. SKIP        — driver already has residentialZip. Never overwritten.
//   2. prefs-zip   — DriverPreference.city holds a 5-digit value. That is
//                    where the driver Preferences page ("Primary ZIP Code"
//                    field) has always saved, so this is REAL data the
//                    driver typed, just stored under the wrong column.
//   3. city-map    — Driver.residentialCity (saved by driver onboarding)
//                    matches a built-in table of major California cities;
//                    the city's representative real ZIP is used.
//   4. random-ca   — nothing usable anywhere: a REAL California ZIP is
//                    picked from a curated pool spanning the whole state
//                    (same region bands as the admin Region picker).
//                    The pick is seeded and hashed from the driver id, so
//                    it is STABLE: the same driver always gets the same
//                    ZIP on every run, and a dry run shows exactly what
//                    --apply will write.
//
// SAFE by design:
//   - Only touches Driver.residentialZip. Never modifies preferences.city
//     or any address field (sources are left exactly as they were).
//   - Only fills drivers whose residentialZip is currently empty (null or
//     blank). The write itself re-checks emptiness row by row, so it can
//     never overwrite even if something changes mid-run.
//   - Every assigned ZIP is a real 5-digit California ZIP (90000-96199).
//   - Random ZIPs are PLACEHOLDERS so the admin filters and lists work.
//     When a driver's true ZIP becomes known, set it on the admin driver
//     detail page — that is always respected from then on.
//   - Default mode is a DRY RUN: prints exactly what would change.
//   - Pass --apply to actually write.
//
// Usage (from the backend folder):
//   npx ts-node scripts/backfill-driver-zips.ts                # dry run
//   npx ts-node scripts/backfill-driver-zips.ts --apply        # write
//   npx ts-node scripts/backfill-driver-zips.ts --seed 7       # other mix
//
// Requires DATABASE_URL (loaded automatically from backend/.env).

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const ZIP_RE = /^\d{5}$/;
const DEFAULT_SEED = 101;

// ---------------------------------------------------------------------------
// Curated pool of REAL California ZIPs, spread across the same region bands
// as the admin Region picker, so a random fill still lands somewhere
// meaningful on the map (LA, Bay Area, Sacramento, ...).
// ---------------------------------------------------------------------------
const CA_ZIP_POOL: string[] = [
  // Los Angeles metro
  "90001", "90011", "90026", "90042", "90201", "90220", "90232", "90280",
  "90301", "90404", "90502", "90601", "90650", "90701", "90802", "91001",
  "91101", "91203", "91331", "91362", "91402", "91501", "91605", "91731",
  "91745", "91755", "91766", "91776", "91790", "91801",
  // San Diego
  "91902", "91910", "91911", "91914", "91932", "91950", "92020", "92037",
  "92054", "92071", "92101", "92111", "92122", "92154",
  // Inland Empire
  "92201", "92210", "92220", "92236", "92264", "92274", "92301", "92313",
  "92335", "92345", "92373", "92376", "92392", "92401", "92408", "92501",
  "92504", "92507", "92518", "92530", "92543", "92545", "92553", "92557",
  "92562", "92570", "92584", "92590", "92596",
  // Orange County
  "92603", "92610", "92618", "92626", "92630", "92646", "92651", "92660",
  "92672", "92683", "92701", "92704", "92780", "92801", "92805", "92807",
  "92821", "92831", "92835", "92840", "92865", "92867", "92869", "92886",
  // Central Coast & Bakersfield
  "93001", "93003", "93010", "93013", "93015", "93030", "93033", "93036",
  "93060", "93065", "93101", "93105", "93111", "93274", "93291", "93301",
  "93304", "93307", "93312", "93401", "93420", "93436", "93454", "93455",
  // High Desert
  "93501", "93504", "93505", "93510", "93534", "93535", "93536", "93543",
  "93544", "93550", "93551", "93552", "93560", "93563", "93565", "93591",
  // Fresno & Central Valley
  "93602", "93611", "93612", "93618", "93619", "93630", "93634", "93637",
  "93638", "93644", "93650", "93662", "93667", "93701", "93704", "93706",
  "93710", "93711", "93720", "93727",
  // Bay Area
  "94014", "94016", "94024", "94025", "94040", "94043", "94061", "94063",
  "94080", "94086", "94087", "94103", "94110", "94112", "94122", "94301",
  "94303", "94401", "94501", "94509", "94520", "94526", "94533", "94538",
  "94541", "94549", "94553", "94558", "94565", "94577", "94583", "94588",
  "94601", "94607", "94610", "94703", "94704", "94801", "94901", "94941",
  "94952", "95014", "95020", "95035", "95050", "95051", "95054", "95060",
  "95062", "95070", "95110", "95112", "95116", "95118", "95120", "95123",
  "95127", "95128", "95136", "95148",
  // Sacramento & Northern California
  "95202", "95204", "95206", "95207", "95219", "95336", "95340", "95354",
  "95355", "95361", "95366", "95376", "95380", "95382", "95605", "95610",
  "95616", "95621", "95624", "95626", "95628", "95630", "95648", "95658",
  "95662", "95670", "95677", "95678", "95682", "95687", "95691", "95742",
  "95746", "95747", "95757", "95758", "95762", "95765", "95926", "95928",
  "95945", "95959", "95965", "95991", "96001", "96002", "96003", "96080",
  "96097", "96130", "96150",
];

// ---------------------------------------------------------------------------
// Major California cities -> one representative real ZIP (central / dense).
// Used when a driver's onboarding saved a city but no usable ZIP.
// ---------------------------------------------------------------------------
const CITY_ZIPS: Record<string, string> = {
  "los angeles": "90001",
  "long beach": "90802",
  "santa monica": "90401",
  "pasadena": "91101",
  "glendale": "91203",
  "burbank": "91501",
  "torrance": "90501",
  "compton": "90220",
  "downey": "90241",
  "whittier": "90601",
  "norwalk": "90650",
  "el monte": "91731",
  "west covina": "91790",
  "pomona": "91766",
  "arcadia": "91006",
  "monrovia": "91016",
  "alhambra": "91801",
  "san fernando": "91340",
  "santa clarita": "91350",
  "lancaster": "93534",
  "palmdale": "93550",
  "oxnard": "93030",
  "thousand oaks": "91362",
  "simi valley": "93065",
  "camarillo": "93010",
  "ventura": "93001",
  "santa barbara": "93101",
  "san luis obispo": "93401",
  "bakersfield": "93301",
  "fresno": "93706",
  "clovis": "93612",
  "visalia": "93291",
  "merced": "95340",
  "modesto": "95354",
  "stockton": "95202",
  "manteca": "95336",
  "tracy": "95376",
  "turlock": "95380",
  "sacramento": "95814",
  "roseville": "95678",
  "elk grove": "95624",
  "folsom": "95630",
  "davis": "95616",
  "vacaville": "95688",
  "fairfield": "94533",
  "vallejo": "94590",
  "concord": "94520",
  "oakland": "94612",
  "berkeley": "94703",
  "richmond": "94801",
  "hayward": "94541",
  "fremont": "94538",
  "daly city": "94014",
  "san francisco": "94103",
  "san mateo": "94401",
  "palo alto": "94301",
  "mountain view": "94040",
  "sunnyvale": "94086",
  "santa clara": "95050",
  "san jose": "95113",
  "cupertino": "95014",
  "milpitas": "95035",
  "gilroy": "95020",
  "santa cruz": "95060",
  "salinas": "93901",
  "monterey": "93940",
  "santa rosa": "95401",
  "napa": "94558",
  "san rafael": "94901",
  "chico": "95926",
  "redding": "96001",
  "yuba city": "95991",
  "eureka": "95501",
  "san diego": "92101",
  "chula vista": "91910",
  "el cajon": "92020",
  "escondido": "92025",
  "oceanside": "92054",
  "carlsbad": "92008",
  "vista": "92083",
  "san marcos": "92069",
  "temecula": "92590",
  "murrieta": "92562",
  "lake elsinore": "92530",
  "corona": "92879",
  "riverside": "92501",
  "moreno valley": "92553",
  "san bernardino": "92401",
  "fontana": "92335",
  "rialto": "92376",
  "victorville": "92392",
  "hesperia": "92345",
  "apple valley": "92307",
  "redlands": "92373",
  "palm springs": "92262",
  "cathedral city": "92234",
  "palm desert": "92260",
  "indio": "92201",
  "el centro": "92243",
  "anaheim": "92805",
  "santa ana": "92701",
  "irvine": "92618",
  "huntington beach": "92648",
  "garden grove": "92843",
  "orange": "92866",
  "fullerton": "92832",
  "buena park": "90620",
  "costa mesa": "92626",
  "newport beach": "92660",
  "tustin": "92780",
  "westminster": "92683",
  "lakewood": "90712",
  "cerritos": "90703",
};

interface DriverRow {
  id: string;
  residentialZip: string | null;
  residentialCity: string | null;
  residentialState: string | null;
  user: { email: string; fullName: string | null } | null;
  preferences: { city: string | null } | null;
}

interface FillPlan {
  row: DriverRow;
  zip: string;
  source: string; // "prefs-zip" | "city:<Name>" | "random-ca"
}

// FNV-1a string hash -> unsigned 32-bit int. Used (not Math.random) so the
// random pick is stable per driver across runs and matches the dry run.
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pickRandomCaZip(driverId: string, seed: number): string {
  const h = hashSeed(`${seed}:${driverId}`);
  return CA_ZIP_POOL[h % CA_ZIP_POOL.length];
}

function normalizeCity(raw: string | null): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

function isCaliforniaState(raw: string | null): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  return s === "" || s === "ca" || s === "calif" || s === "california";
}

async function main(): Promise<void> {
  dotenv.config();

  const apply = process.argv.includes("--apply");
  const seedIdx = process.argv.indexOf("--seed");
  let seed = DEFAULT_SEED;
  if (seedIdx !== -1 && process.argv[seedIdx + 1]) {
    const parsed = Number(process.argv[seedIdx + 1]);
    if (Number.isInteger(parsed) && parsed > 0) seed = parsed;
  }
  const prisma = new PrismaClient();

  try {
    // Scan ALL drivers (not just those with preferences): a driver without
    // preferences rows may still have an onboarding city to map.
    const drivers = (await prisma.driver.findMany({
      select: {
        id: true,
        residentialZip: true,
        residentialCity: true,
        residentialState: true,
        user: { select: { email: true, fullName: true } },
        preferences: { select: { city: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as DriverRow[];

    const kept: string[] = [];
    const plan: FillPlan[] = [];
    const nonCaState: string[] = [];

    for (const row of drivers) {
      const existing = (row.residentialZip ?? "").trim();
      if (ZIP_RE.test(existing)) {
        kept.push(row.id);
        continue;
      }

      // 2) Real ZIP the driver typed, stored under preferences.city
      const prefZip = (row.preferences?.city ?? "").trim();
      if (ZIP_RE.test(prefZip)) {
        plan.push({ row, zip: prefZip, source: "prefs-zip" });
        continue;
      }

      // 3) Onboarding city -> representative ZIP (only for CA/blank state)
      const city = normalizeCity(row.residentialCity);
      const cityZip = isCaliforniaState(row.residentialState)
        ? CITY_ZIPS[city]
        : undefined;
      if (cityZip) {
        const label = (row.residentialCity ?? "").trim();
        plan.push({ row, zip: cityZip, source: `city: ${label}` });
        continue;
      }

      // 4) Stable seeded random real CA ZIP
      if (row.residentialState && !isCaliforniaState(row.residentialState)) {
        nonCaState.push(
          `${row.user?.email ?? row.id} — onboarding state says ` +
            `${row.residentialState.trim()} but got a CA ZIP (pool is CA-only)`,
        );
      }
      plan.push({ row, zip: pickRandomCaZip(row.id, seed), source: "random-ca" });
    }

    console.log("=".repeat(72));
    console.log(
      `Driver ZIP fill (recover real data first, then random California)` +
        `\nseed: ${seed} — same seed = same result on every run`,
    );
    console.log("=".repeat(72));
    console.log(`Drivers scanned:                        ${drivers.length}`);
    console.log(`Already have residentialZip (kept):     ${kept.length}`);
    console.log(`To fill from preferences.city:          ` +
      `${plan.filter((p) => p.source === "prefs-zip").length}`);
    console.log(`To fill from onboarding city:           ` +
      `${plan.filter((p) => p.source.startsWith("city:")).length}`);
    console.log(`To fill with random CA ZIP:             ` +
      `${plan.filter((p) => p.source === "random-ca").length}`);

    if (plan.length > 0) {
      console.log("\nWould set residentialZip for:");
      for (const { row, zip, source } of plan) {
        console.log(
          `  [${source.padEnd(24)}] ${zip}  ${row.user?.email ?? "(no email)"}  ` +
            `${row.user?.fullName ?? "(no name)"}`,
        );
      }
    }

    if (nonCaState.length > 0) {
      console.log("\nReview (state outside CA got a CA ZIP anyway):");
      for (const line of nonCaState) console.log(`  ${line}`);
    }

    if (!apply) {
      console.log(
        `\nDRY RUN — nothing written. Re-run with --apply to write ` +
          `${plan.length} residentialZip value(s).`,
      );
      return;
    }

    if (plan.length === 0) {
      console.log("\nNothing to write.");
      return;
    }

    let updated = 0;
    for (const { row, zip } of plan) {
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

    console.log(
      `\nAPPLIED — ${updated} driver(s) updated. Every driver now has a ` +
        `CA ZIP; replace placeholders with real ZIPs from the admin detail ` +
        `page when they become known.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fill failed:", err);
  process.exit(1);
});
