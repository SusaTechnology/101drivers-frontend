// ─────────────────────────────────────────────────────────────────────────────
// build-zip-regions.ts — regenerate the ZIP→region membership used by the
// admin users Region filter. Zero dependencies: plain Node 18+ or Bun.
//
//   Run:  bun scripts/build-zip-regions.ts
//     (or: npx ts-node scripts/build-zip-regions.ts)
//
// What it does:
//   1. Downloads a ZIP→county crosswalk CSV (see SOURCE_URL).
//   2. Keeps California rows and assigns every ZIP to exactly ONE of the
//      admin's named regions via a real county→region mapping (the old
//      hand-guessed 3-digit bands are gone — they put Salinas 939xx in
//      "Fresno & Central Valley" and left Oceanside 920xx outside
//      "San Diego").
//   3. Emits backend/src/geo/zip-regions.generated.ts (committed to the
//      repo, so the server never needs to download anything at runtime).
//   4. Prints a diff against the previously generated file.
//
// Refresh cadence: quarterly is plenty — ZIP→county assignments almost
// never change. If a download source dies, just point SOURCE_URL at a
// fresher copy of the same 6-column CSV
// (state_fips,state,state_abbr,zipcode,county,city).
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/scpike/us-state-county-zip/master/geo-data.csv";

const OUT_FILE = path.join(
  typeof __dirname !== "undefined" ? __dirname : "",
  "..",
  "src",
  "geo",
  "zip-regions.generated.ts"
);

// Region labels + display order — MUST match the admin dropdown the users
// already know (identical labels to the previous hand-coded list).
const REGION_LABELS: { value: string; label: string }[] = [
  { value: "all-ca", label: "All California" },
  { value: "la", label: "Los Angeles Metro" },
  { value: "sd", label: "San Diego" },
  { value: "ie", label: "Inland Empire (Riverside / San Bernardino)" },
  { value: "oc", label: "Orange County" },
  { value: "central-coast", label: "Central Coast & Bakersfield" },
  { value: "high-desert", label: "High Desert (Palmdale / Lancaster)" },
  { value: "central-valley", label: "Fresno & Central Valley" },
  { value: "bay-area", label: "San Francisco Bay Area" },
  { value: "norcal", label: "Sacramento & Northern California" },
];

// All 58 CA counties → region. Explicit (no fallback bucket) so an
// unexpected county name fails the build loudly instead of silently
// dropping ZIPs.
const COUNTY_TO_REGION: Record<string, string> = {
  // Los Angeles Metro — except the Antelope Valley desert corner (ZIPs
  // starting 935: Palmdale, Lancaster, Lake Los Angeles…), which is the
  // one place a county line can't express the region; handled below.
  "Los Angeles": "la",

  // High Desert — Antelope Valley (LA ∩ 935xx) plus the Eastern Sierra
  // desert counties, which have no better home in our 10 regions.
  Inyo: "high-desert",
  Mono: "high-desert",

  // San Diego region — Imperial joins it (Imperial Valley's nearest
  // market; the old 92200–92599 band had swallowed it into Inland Empire).
  "San Diego": "sd",
  Imperial: "sd",

  // Inland Empire
  Riverside: "ie",
  "San Bernardino": "ie",

  // Orange County
  Orange: "oc",

  // Central Coast & Bakersfield
  Kern: "central-coast",
  "San Luis Obispo": "central-coast",
  "Santa Barbara": "central-coast",
  Ventura: "central-coast",
  Monterey: "central-coast",

  // Fresno & Central Valley
  Fresno: "central-valley",
  Madera: "central-valley",
  Tulare: "central-valley",
  Kings: "central-valley",
  Merced: "central-valley",
  Stanislaus: "central-valley",
  "San Joaquin": "central-valley",

  // San Francisco Bay Area
  "San Francisco": "bay-area",
  "San Mateo": "bay-area",
  "Santa Clara": "bay-area",
  Alameda: "bay-area",
  "Contra Costa": "bay-area",
  Marin: "bay-area",
  Sonoma: "bay-area",
  Napa: "bay-area",
  Solano: "bay-area",
  "Santa Cruz": "bay-area",
  "San Benito": "bay-area",

  // Sacramento & Northern California — everything north of the Tehachapi
  // plus the Sierra counties.
  Sacramento: "norcal",
  Yolo: "norcal",
  Placer: "norcal",
  "El Dorado": "norcal",
  Sutter: "norcal",
  Yuba: "norcal",
  Butte: "norcal",
  Glenn: "norcal",
  Tehama: "norcal",
  Shasta: "norcal",
  Trinity: "norcal",
  Humboldt: "norcal",
  "Del Norte": "norcal",
  Siskiyou: "norcal",
  Modoc: "norcal",
  Lassen: "norcal",
  Plumas: "norcal",
  Sierra: "norcal",
  Nevada: "norcal",
  Colusa: "norcal",
  Lake: "norcal",
  Mendocino: "norcal",
  Amador: "norcal",
  Calaveras: "norcal",
  Tuolumne: "norcal",
  Mariposa: "norcal",
  Alpine: "norcal",
};

// Verified spot checks — the build FAILS if the data stops agreeing with
// these real-world assignments (guards against a bad/changed source file).
const MUST_MATCH: Record<string, string> = {
  "90210": "la", // Beverly Hills
  "90001": "la", // South LA
  "91761": "ie", // Ontario — old band wrongly had it in LA Metro
  "92401": "ie", // San Bernardino — old band missed 923xx/924xx entirely
  "92054": "sd", // Oceanside — old band missed 920xx entirely
  "93901": "central-coast", // Salinas — old band wrongly said Central Valley
  "93308": "central-coast", // Bakersfield (Kern)
  "93550": "high-desert", // Lake Los Angeles (Antelope Valley, LA County)
  "93546": "high-desert", // Mammoth Lakes area (Mono)
  "95814": "norcal", // Sacramento
};

async function main() {
  console.log(`Downloading ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = "state_fips,state,state_abbr,zipcode,county,city";
  if (lines[0].trim() !== header) {
    throw new Error(
      `Unexpected CSV header: "${lines[0]}". Expected "${header}". ` +
        `Point SOURCE_URL at a copy with the same columns.`
    );
  }

  const zipsByRegion = new Map<string, Set<string>>();
  for (const { value } of REGION_LABELS) zipsByRegion.set(value, new Set());
  const antelopeValleyCities = new Set<string>();
  const zipToRegion = new Map<string, string>();
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('"')) {
      throw new Error(`Quoted CSV field on line ${i} — extend the parser.`);
    }
    const cols = line.split(",");
    const stateAbbr = cols[2];
    const zip = cols[3];
    const county = cols[4];
    const city = cols[5];
    if (stateAbbr !== "CA") continue;
    // The source file also contains pseudo-rows for non-geographic ZCTA
    // placeholders ("900HH", "350XX" — PO-Box-only / unique codes with no
    // deliverable geography). Skip them; a real ZIP is 5 digits.
    if (!/^\d{5}$/.test(zip)) {
      skippedRows++;
      continue;
    }
    // The single sub-county split: LA County ZIPs starting 935 are the
    // Antelope Valley desert (Palmdale / Lancaster) → High Desert.
    const region =
      county === "Los Angeles" && zip.startsWith("935")
        ? "high-desert"
        : COUNTY_TO_REGION[county];
    if (!region) {
      throw new Error(
        `Unmapped CA county "${county}" (ZIP ${zip}, city ${city}). ` +
          `Add it to COUNTY_TO_REGION and re-run.`
      );
    }
    if (county === "Los Angeles" && zip.startsWith("935")) {
      antelopeValleyCities.add(city);
    }
    const prev = zipToRegion.get(zip);
    if (prev && prev !== region) {
      throw new Error(
        `ZIP ${zip} assigned to both ${prev} and ${region} — source data conflict.`
      );
    }
    zipToRegion.set(zip, region);
    zipsByRegion.get(region)!.add(zip);
  }

  const totalZips = zipToRegion.size;
  if (totalZips < 1000 || totalZips > 3000) {
    throw new Error(
      `Sanity check failed: ${totalZips} CA ZIPs (expected ~1700-1800 active).`
    );
  }
  // all-ca = every CA ZIP (the backend filter still uses the 90000–96199
  // band for it — exact for California and index-friendly).
  for (const zip of zipToRegion.keys()) zipsByRegion.get("all-ca")!.add(zip);

  for (const [zip, expected] of Object.entries(MUST_MATCH)) {
    const actual = zipToRegion.get(zip);
    if (actual !== expected) {
      throw new Error(
        `Spot check failed: ${zip} is "${actual}", expected "${expected}". ` +
          `The source data changed — review before shipping.`
      );
    }
  }

  // ── Diff against the previously generated file ──────────────────────────
  const diffLines: string[] = [];
  if (fs.existsSync(OUT_FILE)) {
    const oldFile = fs.readFileSync(OUT_FILE, "utf8");
    for (const { value, label } of REGION_LABELS) {
      if (value === "all-ca") continue;
      const m = oldFile.match(
        new RegExp(`value: "${value}"[\\s\\S]*?zips: \\[([^\\]]*)\\]`)
      );
      if (!m) continue;
      const oldZips = new Set(
        [...m[1].matchAll(/"(\d{5})"/g)].map((x) => x[1])
      );
      const newZips = zipsByRegion.get(value)!;
      const added = [...newZips].filter((z) => !oldZips.has(z));
      const removed = [...oldZips].filter((z) => !newZips.has(z));
      if (added.length || removed.length) {
        diffLines.push(
          `  ${label}: +${added.length} [${added.slice(0, 8).join(", ")}]` +
            ` -${removed.length} [${removed.slice(0, 8).join(", ")}]`
        );
      }
    }
  }

  // ── Emit the generated module ────────────────────────────────────────────
  const regionBlocks = REGION_LABELS.map(({ value, label }) => {
    const zips = [...zipsByRegion.get(value)!].sort();
    return `  { value: "${value}", label: "${label}", zips: [${zips
      .map((z) => `"${z}"`)
      .join(", ")}] },`;
  }).join("\n");

  const out = `// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with:  cd backend && bun scripts/build-zip-regions.ts
//   (or: npx ts-node scripts/build-zip-regions.ts)
//
// Source: ZIP→county crosswalk (${SOURCE_URL}).
// Every active California ZIP is assigned to exactly one admin region by
// its REAL county — not by the old hand-guessed 3-digit bands (which put
// Salinas 939xx in "Fresno & Central Valley" and left Oceanside 920xx
// outside "San Diego"). LA County ZIPs starting 935 (Antelope Valley:
// Palmdale / Lancaster) go to "High Desert". Imperial County joins
// "San Diego". Refresh quarterly; the script prints a diff of moved ZIPs.

export const ZIP_REGION_META = {
  source: "${SOURCE_URL}",
  generatedAt: "${new Date().toISOString()}",
  zipCount: ${totalZips},
} as const;

export interface ZipRegionDef {
  value: string;
  label: string;
  zips: string[];
}

export const ZIP_REGIONS: ZipRegionDef[] = [
${regionBlocks}
];
`;

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, out);

  // ── Report ───────────────────────────────────────────────────────────────
  console.log(`\nGenerated ${OUT_FILE}`);
  console.log(`CA ZIPs total: ${totalZips} (skipped ${skippedRows} non-geographic placeholder rows)\n`);
  for (const { value, label } of REGION_LABELS) {
    const n = zipsByRegion.get(value)!.size;
    console.log(`  ${label.padEnd(48)} ${value.padEnd(14)} ${n} ZIPs`);
  }
  if (diffLines.length) {
    console.log(`\nDiff vs previous generated file:`);
    console.log(diffLines.join("\n"));
  } else {
    console.log(`\nDiff vs previous generated file: no changes.`);
  }
  console.log(
    `\nAntelope Valley split (LA County 935xx → High Desert) cities:\n  ` +
      [...antelopeValleyCities].sort().join(", ")
  );
}

main().catch((err) => {
  console.error(`BUILD FAILED: ${err.message}`);
  process.exit(1);
});
