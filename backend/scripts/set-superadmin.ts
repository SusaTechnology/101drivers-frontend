// scripts/set-superadmin.ts
//
// Register or revoke a SUPER ADMIN directly in the database.
//
// The first super admin cannot be created through the API — no super
// admin exists yet to approve the promotion (chicken-and-egg). This
// script is the bootstrap. After the first one exists, promote/demote
// other admins from the Users page (only super admins see those
// actions); this script stays available for recovery.
//
// Usage (from the backend folder):
//   npx ts-node scripts/set-superadmin.ts admin@example.com          # grant
//   npx ts-node scripts/set-superadmin.ts admin@example.com --off    # revoke
//   npx ts-node scripts/set-superadmin.ts admin@example.com --solo   # grant AND make
//                                                                    # them the ONLY super admin
//
// Requires DATABASE_URL (loaded automatically from backend/.env).
//
// Safety rails:
//   - Target must exist and must be an ADMIN (customers/drivers are
//     rejected — this flag only means something on admin accounts).
//   - Grant is refused if the admin's invite was never accepted
//     (email unverified): super powers on an unactivated account are
//     a mistake waiting to happen — accept the invite first.
//   - Revoking the LAST super admin is refused, so the system can never
//     lose all super-admin capability. Run it with --force only if you
//     understand that recovery then requires editing the DB by hand.
//   - --solo grants the target and clears the flag from EVERYONE else,
//     then verifies exactly one super admin remains (the target). It
//     resolves the target by EXACT email (case-insensitive) — never the
//     fuzzy contains-match of the default mode — because it is about to
//     revoke other holders. Idempotent; writes only rows whose flag
//     actually changes.

import * as dotenv from "dotenv";
import { PrismaClient, EnumUserRoles } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

/**
 * --solo mode: make <email> the one and ONLY super admin.
 *
 * Grants the target and clears the flag from every other holder, then
 * verifies the end state (exactly one super admin, the target). The target
 * is resolved by EXACT case-insensitive email — the default mode's fuzzy
 * contains-match is far too loose when the command also revokes others.
 * Same rails as a plain grant: must be an ADMIN, invite must be accepted.
 */
async function grantSolo(targetEmail: string): Promise<void> {
  const matches = await prisma.user.findMany({
    where: { email: { equals: targetEmail, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      isActive: true,
      isSuperAdmin: true,
      emailVerifiedAt: true,
    },
  });

  if (matches.length === 0) {
    console.error(
      `✗ No user found with email exactly "${targetEmail}" (case-insensitive). Nothing was changed.`
    );
    process.exit(1);
  }

  // equals+insensitive returns one row unless duplicate case-variants of
  // the same email exist in the data — refuse to guess in that case.
  const target =
    matches.find((u) => u.email === targetEmail) ??
    (matches.length === 1 ? matches[0] : null);

  if (!target) {
    console.error(
      `✗ Multiple users match email "${targetEmail}" (${matches
        .map((u) => u.email)
        .join(", ")}). Fix the duplicates and re-run. Nothing was changed.`
    );
    process.exit(1);
  }

  if (target.roles !== EnumUserRoles.ADMIN) {
    console.error(
      `✗ ${target.email} is a ${target.roles}, not an ADMIN. ` +
        `Only admin accounts can hold the super-admin flag. Nothing was changed.`
    );
    process.exit(1);
  }

  if (!target.emailVerifiedAt) {
    console.error(
      `✗ ${target.email} has not accepted their admin invite yet ` +
        `(email unverified). Super powers on an unactivated account are ` +
        `refused — let them accept the invite first, then run this again. Nothing was changed.`
    );
    process.exit(1);
  }

  const before = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: { email: true },
  });

  // Clear everyone else first — updateMany only touches rows that
  // currently hold the flag, so on a fresh system this writes nothing.
  const cleared = await prisma.user.updateMany({
    where: { isSuperAdmin: true, id: { not: target.id } },
    data: { isSuperAdmin: false },
  });

  // Grant (skip the write entirely when already correct).
  let granted = false;
  if (!target.isSuperAdmin) {
    await prisma.user.update({
      where: { id: target.id },
      data: { isSuperAdmin: true },
    });
    granted = true;
  }

  // Verify the end state: exactly ONE super admin, and it is the target.
  const after = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: { email: true, roles: true, isActive: true },
  });

  console.log("Before:");
  console.log(
    before.length > 0
      ? before.map((u) => `    - ${u.email}`).join("\n")
      : "    (nobody held the flag)"
  );

  console.log("After:");
  if (granted) {
    console.log(`  ✓ ${target.email} is now a SUPER ADMIN`);
  } else {
    console.log(
      `  ✓ ${target.email} was already a super admin (no write needed)`
    );
  }
  console.log(`  ✓ Cleared the flag from ${cleared.count} other user(s)`);
  console.log(`  ✓ Super admins in the system: ${after.length}`);

  if (
    after.length !== 1 ||
    after[0]?.email.toLowerCase() !== targetEmail ||
    after[0]?.roles !== EnumUserRoles.ADMIN
  ) {
    console.error(
      "✗ Unexpected end state — expected exactly one super admin (the target)." +
        " Inspect the users table before retrying."
    );
    process.exit(1);
  }

  console.log(
    `Done. "${target.email}" is the one and only super admin — nobody else holds the flag.`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => !a.startsWith("--"));
  const off = args.includes("--off");
  const solo = args.includes("--solo");
  const grant = !off;

  if (!emailArg) {
    console.error(
      "Usage: npx ts-node scripts/set-superadmin.ts <email> [--off | --solo]"
    );
    process.exit(1);
  }

  if (solo && off) {
    console.error(
      `✗ --solo and --off cannot be combined — --solo always GRANTS the target.`
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();

  if (solo) {
    await grantSolo(email);
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { contains: email, mode: "insensitive" } },
  });

  if (!user) {
    console.error(`✗ No user found with email containing "${email}".`);
    process.exit(1);
  }

  if (user.roles !== EnumUserRoles.ADMIN) {
    console.error(
      `✗ ${user.email} is a ${user.roles}, not an ADMIN. ` +
        `Only admin accounts can hold the super-admin flag.`
    );
    process.exit(1);
  }

  if (grant && !user.emailVerifiedAt) {
    console.error(
      `✗ ${user.email} has not accepted their admin invite yet ` +
        `(email unverified). Super powers on an unactivated account are ` +
        `refused — let them accept the invite first, then run this again.`
    );
    process.exit(1);
  }

  if (user.isSuperAdmin === grant) {
    console.log(
      `• ${user.email} is already ${grant ? "a super admin" : "a plain admin"} — nothing to do.`
    );
    return;
  }

  if (!grant) {
    const otherSuperAdmins = await prisma.user.count({
      where: { isSuperAdmin: true, id: { not: user.id } },
    });
    if (otherSuperAdmins === 0 && !args.includes("--force")) {
      console.error(
        `✗ ${user.email} is the LAST super admin. Revoking would leave the ` +
          `system without super-admin capability (disable / promote / demote). ` +
          `Promote another admin first, or pass --force if you really mean it.`
      );
      process.exit(1);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isSuperAdmin: grant },
  });

  console.log(
    `✓ ${user.email} is now ${grant ? "a SUPER ADMIN" : "a plain admin"}.`
  );
  console.log(
    grant
      ? "  They get the elevated actions on the Users page after signing in again (or refreshing)."
      : "  Their elevated actions disappear on their next request (JWT re-reads the DB)."
  );
}

main()
  .catch((error) => {
    console.error("✗ Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
