// Backfill: mint Better Auth credential Account rows for existing DRIVER
// users so their legacy bcrypt passwords keep working under Better Auth
// (same hash format — verified by the custom password.verify in
// src/better-auth/create-better-auth.ts).
//
// Idempotent (skips users that already have a credential account), read-mostly
// (only INSERTs Account rows — User rows are never modified), and safe to
// re-run. DRY_RUN=1 prints what it would do. Ops runbook:
//   DRY_RUN=1 npx ts-node scripts/backfill-better-auth-accounts.ts   # preview
//   npx ts-node scripts/backfill-better-auth-accounts.ts             # apply
// Run AFTER the better_auth_identity migration (prisma migrate deploy).
//
// Note: users with NO password hash at all (e.g. INVITED drivers who were
// created via the admin invite flow and never chose a password) are skipped
// — they cannot use email/password until they set one (better-auth
// changePassword / resetPassword flow covers this).

import { PrismaClient, EnumUserRoles } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.env.DRY_RUN === "1";

  const drivers = await prisma.user.findMany({
    where: { roles: EnumUserRoles.DRIVER },
    select: { id: true, email: true, username: true, password: true, passwordHash: true, isActive: true },
  });

  const existingAccounts = await prisma.account.findMany({
    where: { providerId: "credential" },
    select: { userId: true },
  });
  const withCredential = new Set(existingAccounts.map((a) => a.userId));

  let created = 0;
  let skippedAlready = 0;
  let skippedNoHash = 0;
  const noHashEmails: string[] = [];

  for (const user of drivers) {
    if (withCredential.has(user.id)) {
      skippedAlready++;
      continue;
    }
    // Same field the legacy login verifies against (auth.service.validateUser).
    const usableHash = user.password && user.password.length > 0 ? user.password : user.passwordHash;
    if (!usableHash) {
      skippedNoHash++;
      noHashEmails.push(user.email);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would create credential account for ${user.email}`);
      created++;
      continue;
    }
    await prisma.account.create({
      data: {
        userId: user.id,
        // Credential accounts use the user id as the provider accountId
        // (Better Auth convention — see better-auth.com docs, Account model).
        accountId: user.id,
        providerId: "credential",
        password: usableHash,
      },
    });
    created++;
  }

  console.log(
    `Backfill ${dryRun ? "(DRY RUN)" : "complete"}: drivers=${drivers.length}, created=${created}, already=${skippedAlready}, noHash=${skippedNoHash}`
  );
  if (noHashEmails.length) {
    console.log("Users without a usable password hash (skipped):");
    for (const email of noHashEmails) console.log(`  - ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
