// scripts/backfill-personal-flat-pricing.ts
//
// STANDALONE one-time backfill: assigns the active Flat Pricing (PER_MILE)
// config to every existing PERSONAL (PRIVATE) customer — the same rule the
// app now applies automatically at registration, applied retroactively to
// customers who signed up before that existed.
//
// Which config is picked (identical to the registration auto-assign rule):
//   1. The system default config — but ONLY if it is active AND flat
//      (PER_MILE). The default does not govern personal pricing otherwise.
//   2. Otherwise the most recently created ACTIVE flat (PER_MILE) config.
//   If no active flat config exists at all, the script refuses to run and
//   changes nothing — create/activate one in the admin pricing UI first.
//
// SAFE by design:
//   - Touches ONLY Customer rows with customerType = PRIVATE. Business
//     customers are never read or modified.
//   - Personal customers ALREADY on the flat config are left untouched
//     (re-running is safe — idempotent / resumable).
//   - Personal customers on a DIFFERENT config are reported but skipped
//     (an admin may have chosen that deliberately). Pass --force to
//     overwrite those too.
//   - Every assignment writes an audit trail entry (PRICING_UPDATE,
//     actorType SYSTEM) exactly like the registration auto-assign.
//   - Default mode is a DRY RUN: it prints exactly what would change and
//     writes NOTHING.
//
// Usage (from the backend folder):
//   npx ts-node scripts/backfill-personal-flat-pricing.ts             # dry run
//   npx ts-node scripts/backfill-personal-flat-pricing.ts --apply     # write
//   npx ts-node scripts/backfill-personal-flat-pricing.ts --apply --force
//
// Requires DATABASE_URL (loaded automatically from backend/.env).

import * as dotenv from "dotenv";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  PrismaClient,
} from "@prisma/client";

// The row type is DERIVED from the actual Prisma query rather than
// hand-written, so the script compiles against any schema version of the
// generated client (e.g. User.fullName is String? on some deployments and
// String on others — a hand-written interface broke exactly on that).
async function loadPersonalCustomers(prisma: PrismaClient) {
  return prisma.customer.findMany({
    where: { customerType: "PRIVATE" },
    select: {
      id: true,
      pricingConfigId: true,
      createdAt: true,
      user: { select: { email: true, fullName: true } },
      pricingConfig: {
        select: {
          id: true,
          name: true,
          pricingMode: true,
          isDefault: true,
          active: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

type PersonalCustomerRow = Awaited<
  ReturnType<typeof loadPersonalCustomers>
>[number];

function label(row: PersonalCustomerRow): string {
  const name = row.user?.fullName ?? "(no name)";
  const email = row.user?.email ?? "(no email)";
  return `${name} <${email}> [${row.id}]`;
}

async function main(): Promise<void> {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    console.error(
      "✗ DATABASE_URL is not set. Add it to backend/.env (or export it) and retry."
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");

  try {
    console.log("─".repeat(72));

    // ── 1) Resolve the flat config — EXACTLY the registration rule ──
    let flat = await prisma.pricingConfig.findFirst({
      where: { active: true, isDefault: true, pricingMode: "PER_MILE" },
    });

    if (!flat) {
      flat = await prisma.pricingConfig.findFirst({
        where: { active: true, pricingMode: "PER_MILE" },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!flat) {
      console.error(
        "✗ No active Flat Pricing (PER_MILE) config exists in this database.\n" +
          "  Create or activate one in the admin pricing UI first, then re-run.\n" +
          "  Nothing was changed."
      );
      process.exit(1);
    }

    console.log(
      `Flat Pricing config to assign: "${flat.name ?? "(unnamed)"}" [${flat.id}]`
    );
    console.log(
      `  mode=${flat.pricingMode}  isDefault=${flat.isDefault}  baseFee=$${flat.baseFee}` +
        (flat.perMileRate != null ? `  perMileRate=$${flat.perMileRate}/mi` : "") +
        (flat.flatMiles != null ? `  covers first ${flat.flatMiles} mi` : "")
    );
    console.log("─".repeat(72));

    // ── 2) Load every PERSONAL customer ──
    const personal = await loadPersonalCustomers(prisma);

    const alreadyFlat = personal.filter((c) => c.pricingConfigId === flat!.id);
    const unassigned = personal.filter((c) => c.pricingConfigId === null);
    const otherConfig = personal.filter(
      (c) => c.pricingConfigId !== null && c.pricingConfigId !== flat!.id
    );

    console.log(
      `Personal customers found: ${personal.length}` +
        `  (already flat: ${alreadyFlat.length}, unassigned: ${unassigned.length},` +
        ` other config: ${otherConfig.length})`
    );
    console.log("─".repeat(72));

    if (alreadyFlat.length > 0) {
      console.log(`Already on flat pricing (left untouched): ${alreadyFlat.length}`);
    }

    if (unassigned.length > 0) {
      console.log(`\nWill be assigned flat pricing (${unassigned.length}):`);
      for (const c of unassigned) {
        console.log(`  + ${label(c)}  — registered ${c.createdAt.toISOString().slice(0, 10)}`);
      }
    }

    if (otherConfig.length > 0) {
      console.log(
        `\nOn a DIFFERENT config — ${force ? "will be OVERWRITTEN (--force)" : "SKIPPED (pass --force to overwrite)"} (${otherConfig.length}):`
      );
      for (const c of otherConfig) {
        console.log(
          `  ${force ? "!" : "-"} ${label(c)}  — currently "${c.pricingConfig?.name ?? "(unnamed)"}"` +
            ` [${c.pricingConfigId}] mode=${c.pricingConfig?.pricingMode ?? "?"}` +
            `${c.pricingConfig?.active ? "" : " (INACTIVE)"}`
        );
      }
    }

    const targets = force ? [...unassigned, ...otherConfig] : unassigned;

    if (targets.length === 0) {
      console.log(
        "\n✓ Nothing to do — every personal customer is already where they should be."
      );
      console.log("─".repeat(72));
      return;
    }

    if (!apply) {
      console.log(
        `\nDRY RUN — nothing was written. Re-run with --apply to assign` +
          ` "${flat.name ?? flat.id}" to ${targets.length} personal customer(s).`
      );
      console.log("─".repeat(72));
      return;
    }

    // ── 3) Apply: per-customer transaction (update + audit) so a failure
    //      midway leaves everything consistent and the script can simply
    //      be re-run (already-flat customers are skipped). ──
    console.log(`\nApplying ${targets.length} assignment(s)...`);
    let done = 0;
    let failed = 0;

    for (const c of targets) {
      const replaced = c.pricingConfigId
        ? ` (replaced config ${c.pricingConfigId})`
        : "";
      try {
        await prisma.$transaction([
          prisma.customer.update({
            where: { id: c.id },
            data: { pricingConfig: { connect: { id: flat.id } } },
          }),
          prisma.adminAuditLog.create({
            data: {
              action: EnumAdminAuditLogAction.PRICING_UPDATE,
              actorUserId: null,
              actorType: EnumAdminAuditLogActorType.SYSTEM,
              customerId: c.id,
              reason:
                "Backfill: Flat Pricing config assigned (registration rule applied retroactively)" +
                replaced,
            },
          }),
        ]);
        done++;
        console.log(`  ✓ ${label(c)}`);
      } catch (err: any) {
        failed++;
        console.error(`  ✗ ${label(c)} — ${err?.message ?? err}`);
      }
    }

    console.log("─".repeat(72));
    console.log(
      `Done: ${done} assigned, ${failed} failed` +
        (failed > 0 ? " — fix the issue and re-run (already-assigned are skipped)." : ".")
    );
    console.log("─".repeat(72));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ Backfill crashed:", err);
  process.exit(1);
});
