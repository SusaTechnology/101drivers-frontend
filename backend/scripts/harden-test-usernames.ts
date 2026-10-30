// scripts/harden-test-usernames.ts
//
// Rename the SEED / TEST accounts' login names (User.username) to
// hard-to-guess values. ONLY the username changes — email, password,
// roles, everything else stays exactly as it is.
//
// Why: the seeded accounts log in with trivially guessable names
// ("admin", "driver", "private", ...) — anyone who tries admin/admin or
// driver/driver gets in. This script rotates those login names to 16
// fully random characters (e.g. 9f3be2c81a70d4c6) — NO prefix, NO hint,
// no pattern: nothing about the name predicts which account is behind
// it, what role it has, or even that it was machine-generated.
//
// The 7 accounts it touches (matched by EMAIL — emails never change):
//   admin    admin@101drivers.techbee.et
//   private  private.customer@101drivers.techbee.et
//   business business.customer@101drivers.techbee.et
//   dealer2  dealer2@101drivers.techbee.et
//   driver   driver@101drivers.techbee.et
//   driver2  driver2@101drivers.techbee.et
//   driver3  driver3@101drivers.techbee.et
//
// The new names are generated ONCE and saved to
//   scripts/test-username-map.local.json   (gitignored — never commit it)
// Every later run reuses that saved plan, so repeated runs can never
// silently rotate the names out from under the team.
//
// Usage (from the backend folder):
//   npx ts-node scripts/harden-test-usernames.ts                # dry-run: show the plan
//   npx ts-node scripts/harden-test-usernames.ts --yes          # APPLY (rotate the names)
//   npx ts-node scripts/harden-test-usernames.ts --regenerate --yes   # throw the plan away, generate a fresh set, apply (re-rotates accounts already carrying an older rotation)
//   npx ts-node scripts/harden-test-usernames.ts --revert --yes       # restore the ORIGINAL simple names from the plan
//
// Safety rails:
//   - Touches ONLY these 7 emails (exact, case-insensitive). Every other
//     user in the database is unreachable by this script.
//   - The UPDATE payload is { username } and nothing else — email and
//     password are physically not in the write.
//   - Uniqueness is checked before every write (collisions get a fresh
//     draw, 20 tries — practically impossible on a 64-bit space).
//   - If an account's current username is NEITHER the original simple
//     name, NOR a name this script planned before, NOR the planned new
//     one (someone renamed it by hand), the script SKIPS it and says so
//     instead of overwriting.
//   - Idempotent: running --yes twice is a no-op the second time.
//   - --revert restores the original names, so the whole operation is
//     reversible.
//
// NOTE: the seed script creates these accounts with the simple names. If
// you ever re-seed the users, their usernames reset — just run this
// script again with --yes (the saved plan is reused, names stay stable).

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

dotenv.config();
// also read the repo-root .env if present (same convention as the other scripts)
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

const prisma = new PrismaClient();

// ── the ONLY accounts this script may ever touch ──────────────────────────
// NOTE: no prefixes, no hints — a generated login name carries zero
// information about the account behind it.
const TARGETS = [
  { label: "admin",    email: "admin@101drivers.techbee.et" },
  { label: "private",  email: "private.customer@101drivers.techbee.et" },
  { label: "business", email: "business.customer@101drivers.techbee.et" },
  { label: "dealer2",  email: "dealer2@101drivers.techbee.et" },
  { label: "driver",   email: "driver@101drivers.techbee.et" },
  { label: "driver2",  email: "driver2@101drivers.techbee.et" },
  { label: "driver3",  email: "driver3@101drivers.techbee.et" },
] as const;

const MAP_FILE = path.join(__dirname, "test-username-map.local.json");

type PlanEntry = {
  email: string;
  label: string;
  originalUsername: string;
  newUsername: string;
  appliedAt: string | null;
};

type PlanFile = {
  version: number;
  note: string;
  generatedAt: string;
  entries: PlanEntry[];
};

/** Plans written by older versions of this script are treated as stale. */
const PLAN_VERSION = 2;

// ── CLI flags (same style as send-invite-approval-emails.ts) ──────────────
const argv = process.argv.slice(2);
const flag = (name: string): boolean =>
  argv.includes(`--${name}`) || argv.some((a) => a.startsWith(`--${name}=`));
const APPLY = flag("yes");
const REGENERATE = flag("regenerate");
const REVERT = flag("revert");

/** The simple names the seeder created — also what --revert restores. */
const ORIGINALS: Record<string, string> = Object.fromEntries(
  TARGETS.map((t) => [t.email, t.label])
);

/**
 * Returns the usable plan plus the names the PREVIOUS plan wanted (even a
 * stale one). Those previous names stay "acceptable current values" so an
 * account already carrying an older rotation — e.g. the retired
 * hint-prefixed format — can be rotated again without tripping the
 * conflict guard or needing a manual rename first.
 */
function readPlans(): {
  plan: PlanFile | null;
  previousNames: Record<string, string>;
} {
  try {
    const raw = JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) as PlanFile;
    if (!Array.isArray(raw?.entries) || raw.entries.length === 0) {
      return { plan: null, previousNames: {} };
    }
    const previousNames = Object.fromEntries(
      raw.entries.map((e) => [e.email, e.newUsername])
    );
    if (raw.version !== PLAN_VERSION) {
      // Written by an older version of this script (hint-prefixed names).
      // Obsolete — a fresh fully-random plan will be generated, but the
      // old names remain accepted so the rotation can simply re-apply.
      return { plan: null, previousNames };
    }
    return { plan: raw, previousNames };
  } catch {
    return { plan: null, previousNames: {} };
  }
}

function writePlan(plan: PlanFile): void {
  fs.writeFileSync(MAP_FILE, JSON.stringify(plan, null, 2) + "\n");
}

/**
 * 16 random hex characters (64 bits of entropy) — completely opaque.
 * Nothing in the name hints at which account it belongs to, so there is
 * nothing to predict, enumerate or profile.
 */
function generateUsername(taken: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = randomBytes(8).toString("hex");
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  // 20 collisions on a 64-bit space is absurd; fail loudly rather than loop forever.
  throw new Error("could not generate a unique username after 20 tries");
}

/** Reserve usernames that ALREADY exist in the DB so we never collide. */
async function buildTakenSet(): Promise<Set<string>> {
  const users = await prisma.user.findMany({
    select: { username: true },
  });
  return new Set(users.map((u) => u.username.toLowerCase()));
}

async function main(): Promise<void> {
  console.log("=== harden test-account usernames ===");
  console.log(
    `mode: ${REVERT ? "REVERT to original names" : APPLY ? "APPLY" : "DRY-RUN (no writes — pass --yes to apply)"}\n`
  );

  const taken = await buildTakenSet();
  let { plan, previousNames } = readPlans();

  if (REGENERATE && plan) {
    console.log(
      `--regenerate: discarding the saved plan in ${path.basename(MAP_FILE)}\n` +
        `(its names stay accepted as "current", so accounts rotated with it can be rotated again)\n`
    );
    plan = null;
  }

  // ── Load or build the plan ──────────────────────────────────────────────
  if (!plan) {
    if (Object.keys(previousNames).length > 0) {
      console.log(
        `the saved plan used the retired hint-prefixed format (adm-/drv-/biz-…).\n` +
          `generating a fully random set instead — accounts still carrying those\n` +
          `old names will simply be rotated again (same passwords, same emails).\n`
      );
    }
    const entries: PlanEntry[] = TARGETS.map((t) => ({
      email: t.email,
      label: t.label,
      originalUsername: t.label,
      newUsername: generateUsername(taken),
      appliedAt: null,
    }));
    plan = {
      version: PLAN_VERSION,
      note:
        "New login names for the seed/test accounts — fully random, nothing in " +
        "a name hints at the account behind it. Passwords and emails are NOT " +
        "changed by the script. Delete this file and re-run without --yes to " +
        "regenerate a fresh set.",
      generatedAt: new Date().toISOString(),
      entries,
    };
    writePlan(plan);
    console.log(
      `generated a NEW plan → ${path.basename(MAP_FILE)}\n` +
        `(this file is gitignored — keep it safe, it IS the list of new login names)\n`
    );
  } else {
    console.log(`reusing the saved plan → ${path.basename(MAP_FILE)}\n`);
  }

  // ── Resolve each target against the live DB ─────────────────────────────
  const results: Array<{
    label: string;
    email: string;
    found: boolean;
    current: string | null;
    planned: string | null;
    action:
      | "APPLY"          // will rename on --yes
      | "ALREADY_DONE"   // planned name already in place
      | "CONFLICT"       // someone renamed it by hand — not touching
      | "MISSING"        // email not in the DB
      | "REVERT"         // will restore the original name on --yes
      | "REVERT_DONE";   // original name already in place
    note: string;
  }> = [];

  for (const entry of plan.entries) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: entry.email, mode: "insensitive" } },
      select: { id: true, username: true, email: true },
    });

    if (!user) {
      results.push({
        label: entry.label,
        email: entry.email,
        found: false,
        current: null,
        planned: entry.newUsername,
        action: "MISSING",
        note: "no user with this email — nothing to do",
      });
      continue;
    }

    const current = user.username;
    const original = ORIGINALS[entry.email] ?? entry.originalUsername;

    if (REVERT) {
      if (current === original) {
        results.push({ label: entry.label, email: entry.email, found: true, current, planned: original, action: "REVERT_DONE", note: "already has the original name" });
      } else {
        results.push({ label: entry.label, email: entry.email, found: true, current, planned: original, action: "REVERT", note: `will rename "${current}" → "${original}"` });
      }
      continue;
    }

    if (current === entry.newUsername) {
      results.push({ label: entry.label, email: entry.email, found: true, current, planned: entry.newUsername, action: "ALREADY_DONE", note: "already hardened — no write needed" });
      continue;
    }

    if (current !== original) {
      results.push({
        label: entry.label,
        email: entry.email,
        found: true,
        current,
        planned: entry.newUsername,
        action: "CONFLICT",
        note: `current username "${current}" is neither "${original}" nor the planned name — SKIPPED (rename it back by hand first if you want it hardened)`,
      });
      continue;
    }

    results.push({ label: entry.label, email: entry.email, found: true, current, planned: entry.newUsername, action: "APPLY", note: `will rename "${current}" → "${entry.newUsername}"` });
  }

  // ── Report the plan ─────────────────────────────────────────────────────
  console.log("── accounts ──");
  for (const r of results) {
    const status = r.action.padEnd(13);
    console.log(
      `  [${status}] ${r.label.padEnd(9)} ${r.email.padEnd(42)} ` +
        `username: ${r.current ?? "—"}  →  ${r.planned ?? "—"}   ${r.note}`
    );
  }

  const toApply = results.filter((r) => r.action === "APPLY" || r.action === "REVERT");
  const skipped = results.filter((r) => r.action === "CONFLICT" || r.action === "MISSING");

  if (!APPLY) {
    console.log(
      `\ndry-run complete — nothing was written to the database.` +
        `\n  apply the plan      : npx ts-node scripts/harden-test-usernames.ts --yes` +
        `\n  fresh names instead : npx ts-node scripts/harden-test-usernames.ts --regenerate --yes` +
        `\n  undo at any time    : npx ts-node scripts/harden-test-usernames.ts --revert --yes`
    );
    return;
  }

  if (toApply.length === 0) {
    console.log("\nnothing to apply — every account is already in its planned state.");
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  console.log(`\napplying ${toApply.length} rename(s)…`);
  let failed = 0;
  for (const r of toApply) {
    const entry = plan.entries.find((e) => e.email === r.email);
    if (!entry) continue;
    try {
      // The write is EXPLICITLY username-only.
      await prisma.user.update({
        where: { email: r.email },
        data: { username: r.planned! },
      });
      if (r.action === "APPLY") {
        entry.appliedAt = new Date().toISOString();
      } else {
        entry.appliedAt = null; // reverted — plan is no longer applied
      }
      console.log(`  ✓ ${r.email}: "${r.current}" → "${r.planned}"`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${r.email}: ${e?.message ?? e}`);
    }
  }

  writePlan(plan);
  console.log(`\nplan file updated → ${MAP_FILE}`);

  if (skipped.length > 0) {
    console.log(
      `\nNOTE: ${skipped.length} account(s) were skipped (missing or manually renamed) — see the table above.`
    );
  }

  console.log(
    "\nDone. Sign-ins from now on use the NEW usernames — same passwords, same emails." +
      "\nEveryone on the team needs the updated names from the plan file before their next login."
  );

  if (failed > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error("✗ Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
