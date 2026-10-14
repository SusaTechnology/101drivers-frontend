// scripts/delete-seeded-users.ts
//
// ─────────────────────────────────────────────────────────────────────────────
//  Remove the DEMO/SEED accounts (hard-coded credentials in the repo) from
//  the database — WITHOUT any possibility of touching a real user.
//
//  The seeded identities (see scripts/seed/*.seed.ts) are:
//      admin    / admin@101drivers.techbee.et           / password "admin"
//      private  / private.customer@101drivers.techbee.et / password "private"
//      business / business.customer@101drivers.techbee.et / password "business"
//      dealer2  / dealer2@101drivers.techbee.et          / password "dealer2"
//      driver   / driver@101drivers.techbee.et           / password "driver"
//      driver2  / driver2@101drivers.techbee.et          / password "driver2"
//      driver3  / driver3@101drivers.techbee.et          / password "driver3"
//
//  WHY DELETE INSTEAD OF JUST CHANGING THE PASSWORD:
//  these credentials are hard-coded in the repository, so anyone with repo
//  access can sign in. Removing the rows closes the hole completely.
//
//  SAFETY RAILS
//  ────────────
//   1. TRIPLE-LOCK IDENTITY MATCH — a row is a candidate ONLY if username
//      AND email (case-insensitive) AND role ALL match the seed identity.
//      Any partial match (e.g. a real user who registered the username
//      "driver" with their own email) is reported as SKIPPED and never
//      touched. The triple-lock is re-verified inside the delete
//      transaction, immediately before the DELETE runs.
//   2. DRY-RUN BY DEFAULT — without --apply the script only READS and
//      prints a full report (identity match status, related-row counts,
//      per-account decision). Nothing is written.
//   3. LAST-ADMIN GUARD — the seeded admin is never deleted while it is
//      the only active ADMIN (or the only active SUPER ADMIN). The script
//      tells you to invite a new admin first. This guard cannot be
//      overridden by any flag.
//   4. FK-SAFE TOPOLOGICAL DELETE — related rows are removed children-first
//      (assignments, payouts, evidence, payments, disputes, …) in explicit
//      order, inside ONE transaction per account. Any surprise → full
//      rollback of that account, zero partial state.
//   5. REAL-DATA TRIPWIRE — if a seed DRIVER has delivery history belonging
//      to a NON-seed customer (evidence a real dealer used the demo
//      driver), that account is skipped unless --force.
//   6. AUDIT TRAIL IS NEVER DELETED — AdminAuditLog rows referencing the
//      deleted accounts survive with their FK links NULLed by the database
//      (standard practice: history is kept, attribution is lost).
//
//  WHAT IS *NOT* TOUCHED
//  ─────────────────────
//   pricing configs, service districts/polygons, scheduling policies,
//   referral program settings, dealer/investor leads, AdminAuditLog rows.
//
//  USAGE (from the backend folder)
//  ───────────────────────────────
//    npx ts-node scripts/delete-seeded-users.ts
//        Dry run (default) — report only, no writes.
//
//    npx ts-node scripts/delete-seeded-users.ts --apply
//        Delete the exact-match seed accounts.
//
//    npx ts-node scripts/delete-seeded-users.ts --username admin,driver
//        Limit the run to specific seed usernames (comma separated).
//
//    npx ts-node scripts/delete-seeded-users.ts --skip driver3
//        Exclude specific seed usernames.
//
//    npx ts-node scripts/delete-seeded-users.ts --apply --force
//        Override the real-data tripwire (5). Does NOT override the
//        last-admin guard (3).
//
//  Requires DATABASE_URL (loaded automatically from backend/.env).
// ─────────────────────────────────────────────────────────────────────────────

import * as dotenv from "dotenv";
import { EnumUserRoles, PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// The ONLY rows this script is allowed to consider. username + email + role
// must ALL match (email case-insensitive) — see rail (1).
// ─────────────────────────────────────────────────────────────────────────────
type SeedKind = "admin" | "customer" | "driver";

type SeedIdentity = {
  username: string;
  email: string;
  role: EnumUserRoles;
  kind: SeedKind;
};

const SEED_ACCOUNTS: SeedIdentity[] = [
  { username: "admin",    email: "admin@101drivers.techbee.et",            role: EnumUserRoles.ADMIN,             kind: "admin" },
  { username: "private",  email: "private.customer@101drivers.techbee.et", role: EnumUserRoles.PRIVATE_CUSTOMER,  kind: "customer" },
  { username: "business", email: "business.customer@101drivers.techbee.et", role: EnumUserRoles.BUSINESS_CUSTOMER, kind: "customer" },
  { username: "dealer2",  email: "dealer2@101drivers.techbee.et",          role: EnumUserRoles.BUSINESS_CUSTOMER, kind: "customer" },
  { username: "driver",   email: "driver@101drivers.techbee.et",           role: EnumUserRoles.DRIVER,            kind: "driver" },
  { username: "driver2",  email: "driver2@101drivers.techbee.et",          role: EnumUserRoles.DRIVER,            kind: "driver" },
  { username: "driver3",  email: "driver3@101drivers.techbee.et",          role: EnumUserRoles.DRIVER,            kind: "driver" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");

function csvFlag(name: string): string[] | null {
  const hit = args.find((a) => a === name || a.startsWith(`${name}=`));
  if (!hit) return null;
  const value = hit.includes("=") ? hit.split("=")[1] : null;
  if (!hit.includes("=")) {
    console.error(`✗ ${name} requires a comma-separated value, e.g. ${name}=admin,driver`);
    process.exit(1);
  }
  return value!.split(",").map((s) => s.trim()).filter(Boolean);
}

const onlyUsernames = csvFlag("--username");
const skipUsernames = new Set(csvFlag("--skip") ?? []);

const targets = SEED_ACCOUNTS.filter((a) => {
  if (onlyUsernames && !onlyUsernames.includes(a.username)) return false;
  if (skipUsernames.has(a.username)) return false;
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
// Identity resolution — triple-lock classification (read-only)
// ─────────────────────────────────────────────────────────────────────────────
type MatchStatus =
  | "EXACT"                    // username + email + role all match → deletion candidate
  | "USERNAME_TAKEN_BY_OTHER"  // username exists but email/role differ → DO NOT TOUCH
  | "EMAIL_TAKEN_BY_OTHER"     // email exists on a different username → DO NOT TOUCH
  | "NOT_FOUND";               // already gone

type UserRow = {
  id: string; username: string; email: string; roles: EnumUserRoles;
  isActive: boolean; isSuperAdmin: boolean; emailVerifiedAt: Date | null;
  lastLoginAt: Date | null; disabledAt: Date | null; createdAt: Date;
};

type Resolution = {
  identity: SeedIdentity;
  status: MatchStatus;
  user?: UserRow;
  note?: string;
};

async function resolveIdentity(identity: SeedIdentity): Promise<Resolution> {
  const byUsername = await prisma.user.findUnique({
    where: { username: identity.username },
  });
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: identity.email, mode: "insensitive" } },
  });

  const emailMatches =
    !!byUsername && byUsername.email.toLowerCase() === identity.email.toLowerCase();
  const roleMatches = !!byUsername && byUsername.roles === identity.role;

  if (byUsername && emailMatches && roleMatches && byEmail && byEmail.id === byUsername.id) {
    return { identity, status: "EXACT", user: byUsername as UserRow };
  }

  if (byUsername) {
    return {
      identity,
      status: "USERNAME_TAKEN_BY_OTHER",
      user: byUsername as UserRow,
      note:
        `username "${identity.username}" belongs to email "${byUsername.email}" ` +
        `role ${byUsername.roles} — NOT the seed identity, never touched`,
    };
  }

  if (byEmail) {
    return {
      identity,
      status: "EMAIL_TAKEN_BY_OTHER",
      user: byEmail as UserRow,
      note:
        `email "${identity.email}" belongs to username "${byEmail.username}" ` +
        `— NOT the seed identity, never touched`,
    };
  }

  return { identity, status: "NOT_FOUND" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight report — related row counts per exact-match candidate
// ─────────────────────────────────────────────────────────────────────────────
type CountLine = { label: string; count: number; flag?: "tripwire" | "note" };

async function relatedCounts(
  resolution: Resolution,
  seedCustomerProfileIds: string[],
  seedUsernames: string[]
): Promise<CountLine[]> {
  const user = resolution.user!;
  const lines: CountLine[] = [];

  if (resolution.identity.kind === "customer") {
    const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (customer) {
      const owned = await prisma.deliveryRequest.findMany({
        where: { customerId: customer.id },
        select: { id: true },
      });
      const ownedIds = owned.map((d) => d.id);
      const outsideDriverAssignments = ownedIds.length
        ? await prisma.deliveryAssignment.count({
            where: {
              deliveryId: { in: ownedIds },
              driver: { user: { username: { notIn: seedUsernames } } },
            },
          })
        : 0;
      lines.push({ label: "customer profile", count: 1 });
      lines.push({ label: "deliveries owned (will be purged with the account)", count: ownedIds.length });
      lines.push({ label: "  └ deliveries assigned to NON-seed drivers (their assignment history goes too)", count: outsideDriverAssignments, flag: outsideDriverAssignments ? "note" : undefined });
      lines.push({ label: "invoices", count: await prisma.invoice.count({ where: { customerId: customer.id } }) });
      lines.push({ label: "billing audit findings", count: await prisma.billingAuditFinding.count({ where: { customerId: customer.id } }) });
      lines.push({ label: "referral credits", count: await prisma.referralCredit.count({ where: { customerId: customer.id } }) });
      lines.push({ label: "saved addresses / vehicles", count: await prisma.savedAddress.count({ where: { customerId: customer.id } }) + await prisma.savedVehicle.count({ where: { customerId: customer.id } }) });
      lines.push({ label: "support requests raised", count: await prisma.supportRequest.count({ where: { userId: user.id } }) });
    } else {
      lines.push({ label: "customer profile", count: 0, flag: "note" });
    }
  }

  if (resolution.identity.kind === "driver") {
    const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
    if (driver) {
      const assignments = await prisma.deliveryAssignment.findMany({
        where: { driverId: driver.id },
        select: { delivery: { select: { customerId: true } } },
      });
      const foreign = assignments.filter(
        (a) => !seedCustomerProfileIds.includes(a.delivery.customerId)
      );
      lines.push({ label: "driver profile", count: 1 });
      lines.push({ label: "delivery assignments", count: assignments.length });
      lines.push({ label: "driver payouts / adjustments", count: await prisma.driverPayout.count({ where: { driverId: driver.id } }) + await prisma.driverPayoutAdjustment.count({ where: { driverId: driver.id } }) });
      lines.push({ label: "payout batches / items", count: await prisma.payoutBatch.count({ where: { driverId: driver.id } }) + await prisma.payoutBatchItem.count({ where: { batch: { driverId: driver.id } } }) });
      lines.push({ label: "ratings received", count: await prisma.deliveryRating.count({ where: { driverId: driver.id } }) });
      lines.push({
        label:
          "  └ TRIPWIRE: assignments on deliveries owned by NON-seed customers",
        count: foreign.length,
        flag: "tripwire",
      });
      lines.push({ label: "support requests raised", count: await prisma.supportRequest.count({ where: { userId: user.id } }) });
    } else {
      lines.push({ label: "driver profile", count: 0, flag: "note" });
    }
  }

  if (resolution.identity.kind === "admin") {
    lines.push({ label: "support requests raised", count: await prisma.supportRequest.count({ where: { userId: user.id } }) });
    lines.push({ label: "audit-log rows as ACTOR (kept, de-attributed)", count: await prisma.adminAuditLog.count({ where: { actorUserId: user.id } }), flag: "note" });
  }

  lines.push({ label: "notifications in their inbox", count: await prisma.notificationEvent.count({ where: { toUserId: user.id } }) });
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deletion — ordered, topological, one transaction per account.
// `t` is the interactive transaction client.
// ─────────────────────────────────────────────────────────────────────────────
class SkipAccount extends Error {}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Re-verify the triple-lock inside the transaction, right before the DELETE. */
async function assertStillSeedRow(t: Tx, identity: SeedIdentity, userId: string): Promise<void> {
  const row = await t.user.findUnique({ where: { id: userId } });
  if (
    !row ||
    row.username !== identity.username ||
    row.email.toLowerCase() !== identity.email.toLowerCase() ||
    row.roles !== identity.role
  ) {
    throw new SkipAccount(
      `row changed since the report (no longer an exact triple-lock match) — skipped`
    );
  }
}

/** Delete every child row that REQUIRED-references the given deliveries, then the deliveries. */
async function purgeDeliveries(t: Tx, deliveryIds: string[]): Promise<void> {
  if (deliveryIds.length === 0) return;

  // Children of children first (required FKs, no cascade in schema).
  const sessions = await t.trackingSession.findMany({
    where: { deliveryId: { in: deliveryIds } },
    select: { id: true },
  });
  await t.trackingPoint.deleteMany({
    where: { sessionId: { in: sessions.map((s) => s.id) } },
  });
  await t.trackingSession.deleteMany({ where: { deliveryId: { in: deliveryIds } } });

  const disputes = await t.disputeCase.findMany({
    where: { deliveryId: { in: deliveryIds } },
    select: { id: true },
  });
  await t.disputeNote.deleteMany({
    where: { disputeId: { in: disputes.map((d) => d.id) } },
  });
  await t.disputeCase.deleteMany({ where: { deliveryId: { in: deliveryIds } } });

  const payments = await t.payment.findMany({
    where: { deliveryId: { in: deliveryIds } },
    select: { id: true },
  });
  await t.paymentEvent.deleteMany({
    where: { paymentId: { in: payments.map((p) => p.id) } },
  });
  await t.payment.deleteMany({ where: { deliveryId: { in: deliveryIds } } });

  // Direct children with REQUIRED delivery FK (RESTRICT would block the delete).
  await t.deliveryEvidence.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.deliveryCompliance.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.evidenceExport.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.deliveryStatusHistory.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.scheduleChangeRequest.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.driverRouteCache.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.tip.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.deliveryRating.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.referralCredit.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await t.deliveryAssignment.deleteMany({ where: { deliveryId: { in: deliveryIds } } });

  // The deliveries themselves. Optional FKs elsewhere (notifications,
  // audit logs, support tickets, payouts) are NULLed by the database.
  await t.deliveryRequest.deleteMany({ where: { id: { in: deliveryIds } } });
}

async function purgeCustomerAccount(t: Tx, userId: string): Promise<string[]> {
  const deleted: string[] = [];

  const customer = await t.customer.findUnique({ where: { userId } });
  if (customer) {
    // Invoices BEFORE payments (invoice.paymentId is a required FK).
    const invoices = await t.invoice.deleteMany({ where: { customerId: customer.id } });
    if (invoices.count) deleted.push(`${invoices.count} invoice(s)`);

    const findings = await t.billingAuditFinding.deleteMany({ where: { customerId: customer.id } });
    if (findings.count) deleted.push(`${findings.count} billing audit finding(s)`);

    const credits = await t.referralCredit.deleteMany({ where: { customerId: customer.id } });
    if (credits.count) deleted.push(`${credits.count} referral credit(s)`);

    const referrals = await t.referral.deleteMany({ where: { referredCustomerId: customer.id } });
    if (referrals.count) deleted.push(`${referrals.count} referral row(s)`);

    const ratings = await t.deliveryRating.deleteMany({ where: { customerId: customer.id } });
    if (ratings.count) deleted.push(`${ratings.count} rating(s) given`);

    const owned = await t.deliveryRequest.findMany({
      where: { customerId: customer.id },
      select: { id: true },
    });
    await purgeDeliveries(t, owned.map((d) => d.id));
    if (owned.length) deleted.push(`${owned.length} delivery request(s) with all their children`);

    const notifs = await t.notificationEvent.deleteMany({
      where: { OR: [{ customerId: customer.id }, { toUserId: userId }] },
    });
    if (notifs.count) deleted.push(`${notifs.count} notification row(s)`);

    // SupportRequestNote rows cascade via FK (onDelete: Cascade).
    const tickets = await t.supportRequest.deleteMany({ where: { userId } });
    if (tickets.count) deleted.push(`${tickets.count} support request(s)`);

    await t.savedVehicle.deleteMany({ where: { customerId: customer.id } });
    await t.savedAddress.deleteMany({ where: { customerId: customer.id } }); // defaultPickupId refs NULL out via FK
    await t.customer.delete({ where: { id: customer.id } });
    deleted.push("customer profile");
  }

  await t.user.delete({ where: { id: userId } });
  deleted.push("user row");
  return deleted;
}

async function purgeDriverAccount(t: Tx, userId: string, seedCustomerProfileIds: string[]): Promise<string[]> {
  const deleted: string[] = [];

  const driver = await t.driver.findUnique({ where: { userId } });
  if (!driver) {
    await t.user.delete({ where: { id: userId } });
    return ["user row (no driver profile present)"];
  }

  // Rail (5) — real-data tripwire: refuse when the demo driver touched
  // deliveries belonging to customers that are NOT being deleted in this run.
  const assignments = await t.deliveryAssignment.findMany({
    where: { driverId: driver.id },
    select: { id: true, delivery: { select: { customerId: true } } },
  });
  const foreign = assignments.filter(
    (a) => !seedCustomerProfileIds.includes(a.delivery.customerId)
  );
  if (foreign.length > 0 && !FORCE) {
    throw new SkipAccount(
      `driver has ${foreign.length} assignment(s) on deliveries owned by NON-seed ` +
        `customers (customer ids: ${[...new Set(foreign.map((a) => a.delivery.customerId))].join(", ")}) — ` +
        `real delivery history is attached to this demo account. Re-run with --force to delete anyway.`
    );
  }

  const payouts = await t.driverPayout.findMany({
    where: { driverId: driver.id },
    select: { id: true },
  });
  const payoutIds = payouts.map((p) => p.id);
  const items = await t.payoutBatchItem.deleteMany({
    where: { OR: [{ driverPayoutId: { in: payoutIds } }, { batch: { driverId: driver.id } }] },
  });
  if (items.count) deleted.push(`${items.count} payout batch item(s)`);
  const adjustments = await t.driverPayoutAdjustment.deleteMany({ where: { driverId: driver.id } });
  if (adjustments.count) deleted.push(`${adjustments.count} payout adjustment(s)`);
  const payoutRows = await t.driverPayout.deleteMany({ where: { driverId: driver.id } });
  if (payoutRows.count) deleted.push(`${payoutRows.count} payout row(s)`);
  const batches = await t.payoutBatch.deleteMany({ where: { driverId: driver.id } });
  if (batches.count) deleted.push(`${batches.count} payout batch(es)`);

  const assign = await t.deliveryAssignment.deleteMany({ where: { driverId: driver.id } });
  if (assign.count) deleted.push(`${assign.count} delivery assignment(s)`);

  await t.driverRouteCache.deleteMany({ where: { driverId: driver.id } });
  await t.driverLocation.deleteMany({ where: { driverId: driver.id } });
  await t.driverBankAccount.deleteMany({ where: { driverId: driver.id } });
  await t.driverPreference.deleteMany({ where: { driverId: driver.id } });
  await t.driverAlertPreference.deleteMany({ where: { driverId: driver.id } });
  await t.driverDistrictPreference.deleteMany({ where: { driverId: driver.id } });

  const referrals = await t.referral.deleteMany({
    where: { OR: [{ referrerId: driver.id }, { referredDriverId: driver.id }] },
  });
  if (referrals.count) deleted.push(`${referrals.count} referral row(s)`);

  const ratings = await t.deliveryRating.deleteMany({ where: { driverId: driver.id } });
  if (ratings.count) deleted.push(`${ratings.count} rating(s) received`);

  const notifs = await t.notificationEvent.deleteMany({
    where: { OR: [{ driverId: driver.id }, { toUserId: userId }] },
  });
  if (notifs.count) deleted.push(`${notifs.count} notification row(s)`);

  const tickets = await t.supportRequest.deleteMany({ where: { userId } });
  if (tickets.count) deleted.push(`${tickets.count} support request(s)`);

  await t.driver.delete({ where: { id: driver.id } });
  deleted.push("driver profile");
  await t.user.delete({ where: { id: userId } });
  deleted.push("user row");
  return deleted;
}

async function purgeAdminAccount(t: Tx, userId: string): Promise<string[]> {
  // Rail (3) — LAST-ADMIN GUARD, evaluated on fresh data inside the
  // transaction and overridable by NO flag.
  const row = await t.user.findUnique({ where: { id: userId } });
  if (!row) throw new SkipAccount("row vanished mid-run — skipped");

  const otherActiveAdmins = await t.user.count({
    where: { roles: EnumUserRoles.ADMIN, isActive: true, id: { not: userId } },
  });
  if (otherActiveAdmins === 0) {
    throw new SkipAccount(
      "this is the ONLY active ADMIN account — deleting it would lock everyone out of " +
        "the admin panel. Invite a new admin (Admin → Users), have them accept and sign in, then re-run this script."
    );
  }
  if (row.isSuperAdmin) {
    const otherSuperAdmins = await t.user.count({
      where: { isSuperAdmin: true, isActive: true, id: { not: userId } },
    });
    if (otherSuperAdmins === 0) {
      throw new SkipAccount(
        "this is the ONLY active SUPER ADMIN — promote another admin first " +
          "(npx ts-node scripts/set-superadmin.ts <email>), then re-run this script."
      );
    }
  }

  const deleted: string[] = [];
  const notifs = await t.notificationEvent.deleteMany({ where: { toUserId: userId } });
  if (notifs.count) deleted.push(`${notifs.count} notification row(s)`);
  const tickets = await t.supportRequest.deleteMany({ where: { userId } });
  if (tickets.count) deleted.push(`${tickets.count} support request(s) raised`);
  // Everything else referencing the admin (audit logs, status history,
  // deliveries created, compliance verifications…) is an OPTIONAL FK —
  // the database NULLs those links. Audit history is preserved.
  await t.user.delete({ where: { id: userId } });
  deleted.push("user row (audit trail preserved, actor links NULLed)");
  return deleted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (d: Date | null) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "—");

function printResolution(res: Resolution, counts: CountLine[] | null): void {
  console.log(`\n● ${res.identity.username}  <${res.identity.email}>  [${res.identity.role}]`);
  if (res.status === "NOT_FOUND") {
    console.log("  ✓ not present in the database — nothing to do");
    return;
  }
  if (res.status !== "EXACT") {
    console.log(`  ⚠ SKIPPED — ${res.note}`);
    if (res.user) {
      console.log(`    (row found: id=${res.user.id}, created ${fmt(res.user.createdAt)})`);
    }
    return;
  }
  const u = res.user!;
  console.log(
    `  id=${u.id}  created=${fmt(u.createdAt)}  lastLogin=${fmt(u.lastLoginAt)}  ` +
      `verified=${u.emailVerifiedAt ? "yes" : "no"}  active=${u.isActive ? "yes" : "no"}` +
      `${u.isSuperAdmin ? "  SUPER ADMIN" : ""}`
  );
  for (const line of counts ?? []) {
    const mark =
      line.flag === "tripwire" ? "  ⚠" : line.flag === "note" ? "  •" : "  -";
    console.log(`${mark} ${line.label}: ${line.count}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
type Outcome =
  | { kind: "DELETED"; deleted: string[] }
  | { kind: "SKIPPED"; reason: string }
  | { kind: "FAILED"; error: string };

async function main(): Promise<void> {
  console.log("101 Drivers — remove seeded demo accounts (hard-coded credentials)");
  console.log(`Mode: ${APPLY ? "APPLY — rows WILL be deleted" : "DRY RUN — read-only report"}`);
  if (FORCE) console.log("Flag: --force (real-data tripwire overridden where it fires)");

  // 1 ─ Resolve every identity (read-only)
  const resolutions: Resolution[] = [];
  for (const identity of targets) {
    resolutions.push(await resolveIdentity(identity));
  }

  const exact = resolutions.filter((r) => r.status === "EXACT" && r.user);
  const seedUsernames = SEED_ACCOUNTS.map((a) => a.username);

  // Customer profile ids that WILL be purged this run — the driver tripwire
  // compares against exactly this set.
  const seedCustomerProfileIds: string[] = [];
  for (const res of exact) {
    if (res.identity.kind !== "customer") continue;
    const customer = await prisma.customer.findUnique({
      where: { userId: res.user!.id },
      select: { id: true },
    });
    if (customer) seedCustomerProfileIds.push(customer.id);
  }

  // 2 ─ Report
  console.log("\n──────────── PRE-FLIGHT REPORT ────────────");
  for (const res of resolutions) {
    const counts =
      res.status === "EXACT"
        ? await relatedCounts(res, seedCustomerProfileIds, seedUsernames)
        : null;
    printResolution(res, counts);
  }

  const exactCount = exact.length;
  console.log("\n──────────── SUMMARY ────────────");
  console.log(
    `Exact seed-identity matches: ${exactCount} / ${targets.length}` +
      (targets.length < SEED_ACCOUNTS.length ? ` (filtered from the full list of ${SEED_ACCOUNTS.length})` : "")
  );
  if (exactCount === 0) {
    console.log("Nothing matches the seed identities exactly — the database is already clean.");
    return;
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing was written.");
    console.log("Review the report above, then re-run with --apply to delete the accounts listed as exact matches.");
    return;
  }

  // 3 ─ Apply — customers first (frees their deliveries), then drivers
  // (tripwire compares against the customers actually being purged), then
  // the admin last. ONE transaction per account: a failure rolls back that
  // account only and never leaves partial state.
  const order = [...exact].sort((a, b) => {
    const rank = (k: SeedKind) => (k === "customer" ? 0 : k === "driver" ? 1 : 2);
    return rank(a.identity.kind) - rank(b.identity.kind);
  });

  const outcomes = new Map<string, Outcome>();
  console.log("\n──────────── APPLY ────────────");
  for (const res of order) {
    const { username, kind } = res.identity;
    const userId = res.user!.id;
    process.stdout.write(`Deleting ${username} (${kind}) … `);
    try {
      const deleted = await prisma.$transaction(async (t) => {
        await assertStillSeedRow(t, res.identity, userId);
        if (kind === "customer") return purgeCustomerAccount(t, userId);
        if (kind === "driver") return purgeDriverAccount(t, userId, seedCustomerProfileIds);
        return purgeAdminAccount(t, userId);
      });
      outcomes.set(username, { kind: "DELETED", deleted });
      console.log(`done — ${deleted.join(", ")}`);
    } catch (error) {
      if (error instanceof SkipAccount) {
        outcomes.set(username, { kind: "SKIPPED", reason: error.message });
        console.log(`SKIPPED — ${error.message}`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.set(username, { kind: "FAILED", error: message });
        console.log(`FAILED — ${message}`);
        console.log("  (transaction rolled back — no partial rows were left behind)");
      }
    }
  }

  // 4 ─ Verify end state: none of the seed identities may remain,
  // unless the account was intentionally skipped (guard fired).
  console.log("\n──────────── VERIFICATION ────────────");
  let remaining = 0;
  for (const identity of targets) {
    const after = await resolveIdentity(identity);
    const outcome = outcomes.get(identity.username);
    if (after.status === "NOT_FOUND") {
      console.log(`  ✓ ${identity.username}: gone`);
    } else if (outcome?.kind === "SKIPPED") {
      console.log(`  ✓ ${identity.username}: intentionally kept — ${outcome.reason}`);
    } else {
      remaining += 1;
      console.log(`  ⚠ ${identity.username}: still present (${after.status})`);
    }
  }

  // 5 ─ Exit code + operational notes
  const failures = [...outcomes.values()].filter((o) => o.kind === "FAILED");
  if (failures.length > 0 || remaining > 0) {
    console.error(`\n✗ Finished WITH ISSUES — ${failures.length} failed, ${remaining} still present. Investigate above.`);
    process.exitCode = 1;
  } else {
    console.log("\n✓ Done — every targeted seed identity is gone or was safely skipped with a reason.");
  }
  console.log(
    "\nNotes:\n" +
      "  • Existing JWTs of deleted accounts stay valid until they expire (stateless auth).\n" +
      "    If tokens might be in the wild, rotate JWT_SECRET in backend/.env and restart the API\n" +
      "    (signs everyone out once).\n" +
      "  • npm run seed would recreate these accounts — as of this change the demo seed only\n" +
      "    runs when SEED_DEMO_USERS=1 is set.\n" +
      "  • Demo photos uploaded to the CDN (evidence/thumbnails) are not deleted — cosmetic only."
  );
}

main()
  .catch((error) => {
    console.error("✗ Failed:", error instanceof Error ? error.message : error);
    console.error("  (no changes were applied — deletions run per-account in transactions only after the report)");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

