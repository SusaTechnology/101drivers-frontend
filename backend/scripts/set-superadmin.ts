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
//   - Idempotent: granting an existing super admin / revoking a plain
//     admin is a no-op that reports the current state.

import * as dotenv from "dotenv";
import { PrismaClient, EnumUserRoles } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [emailArg, flag] = process.argv.slice(2);
  const grant = flag !== "--off";

  if (!emailArg) {
    console.error(
      "Usage: npx ts-node scripts/set-superadmin.ts <email> [--off]"
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();

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
    if (otherSuperAdmins === 0 && flag !== "--force") {
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
