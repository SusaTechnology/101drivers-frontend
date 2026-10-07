// scripts/backfill-private-capture-events.ts
//
// STANDALONE one-time backfill: writes the missing CAPTURE PaymentEvent for
// historical PRIVATE-customer payments that were instantly captured at
// delivery creation but whose event trail only shows the generic AUTHORIZE
// row ("Prepaid payment authorized via Stripe at delivery creation").
//
// WHY: until commit ea9ffc2 (Oct 7 2026) the three delivery-creation paths
// wrote ONLY an AUTHORIZE event — even though for private customers the
// PaymentIntent is created with capture_method='automatic' and confirm:true,
// so the money was ALREADY collected at that moment (Payment row flipped to
// CAPTURED + capturedAt set). The CAPTURE event normally arrives via the
// payment_intent.succeeded webhook, but that webhook is not guaranteed to be
// processed — and demonstrably never landed for some payments (e.g.
// cmuvtlg7z00242fcrzwcp31x6, $63.11, private, events: 1×AUTHORIZE only).
// New payments now get the CAPTURE event at creation
// (recordInstantCapturePaymentEvent in the orchestrator); this script
// repairs the historical rows so admins can see the money was collected.
//
// SAFE by design:
//   - Selects ONLY payments matching the exact instant-capture signature:
//       status = CAPTURED, paymentType = PREPAID,
//       the delivery's customer is PRIVATE,
//       capturedAt + providerPaymentIntentId both set,
//       and NO CAPTURE event exists yet.
//     There is no other path that captures a private customer's
//     PaymentIntent (capturePaymentIntent is only called by the business
//     lock-in / completion engines), so PRIVATE + CAPTURED is by
//     construction the creation-time instant capture.
//   - Business prepaid and postpaid payments are structurally excluded.
//   - Only ADDITIVE PaymentEvent rows are written — payment amounts,
//     statuses, dates, and existing events are never modified.
//   - Idempotent: the no-existing-CAPTURE-event filter makes re-runs
//     no-ops (also true after the live webhook writes its own event).
//   - Default mode is a DRY RUN: prints exactly what would be written.
//   - Pass --apply to actually write.
//
// Usage (from the backend folder):
//   npx ts-node scripts/backfill-private-capture-events.ts            # dry run
//   npx ts-node scripts/backfill-private-capture-events.ts --apply    # write
//
// Requires DB_URL (schema.prisma reads env("DB_URL"); falls back to
// DATABASE_URL like the seed-content scripts do).

import * as dotenv from "dotenv";
import {
  EnumCustomerCustomerType,
  EnumPaymentEventType,
  EnumPaymentEventStatus,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  PrismaClient,
} from "@prisma/client";

// schema.prisma reads env("DB_URL"), but some deployments only set
// DATABASE_URL — mirror the seed-content scripts' fallback.
if (!process.env.DB_URL && process.env.DATABASE_URL) {
  process.env.DB_URL = process.env.DATABASE_URL;
}

async function main(): Promise<void> {
  dotenv.config();
  if (!process.env.DB_URL) {
    console.error(
      "✗ DB_URL is not set. Add it to backend/.env (or export DB_URL / DATABASE_URL) and retry.",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const apply = process.argv.includes("--apply");

  try {
    const payments = await prisma.payment.findMany({
      where: {
        status: EnumPaymentStatus.CAPTURED,
        paymentType: EnumPaymentPaymentType.PREPAID,
        capturedAt: { not: null },
        providerPaymentIntentId: { not: null },
        delivery: {
          customer: { customerType: EnumCustomerCustomerType.PRIVATE },
        },
        // The whole point: this payment has no CAPTURE record yet.
        // Also makes the script idempotent and respects any CAPTURE event
        // the webhook may have written on its own.
        events: { none: { type: EnumPaymentEventType.CAPTURE } },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        authorizedAt: true,
        capturedAt: true,
        paymentType: true,
        providerPaymentIntentId: true,
        delivery: {
          select: {
            id: true,
            customer: {
              select: {
                id: true,
                businessName: true,
                contactEmail: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
        events: {
          where: { type: EnumPaymentEventType.AUTHORIZE },
          select: { id: true, message: true, createdAt: true },
          orderBy: { createdAt: "asc" as const },
        },
      },
      orderBy: { capturedAt: "asc" as const },
    });

    console.log("─".repeat(84));
    console.log(
      `Private instant-capture payments missing their CAPTURE event: ${payments.length}` +
        (payments.length === 0 ? " — nothing to do." : ""),
    );
    if (payments.length > 0) {
      console.log("─".repeat(84));
      let total = 0;
      for (const p of payments) {
        const who =
          p.delivery.customer.user?.fullName ||
          p.delivery.customer.businessName ||
          p.delivery.customer.user?.email ||
          p.delivery.customer.contactEmail ||
          p.delivery.customer.id;
        const authEvt = p.events[0];
        console.log(
          `  ${(p.capturedAt ?? p.createdAt).toISOString().slice(0, 16).replace("T", " ")}  ` +
            `$${Number(p.amount).toFixed(2).padStart(8)}  ${who}` +
            `\n    payment ${p.id} · delivery ${p.delivery.id}` +
            `\n    PI ${p.providerPaymentIntentId}` +
            `\n    existing events: ${p.events.length}×AUTHORIZE` +
            (authEvt ? ` ("${authEvt.message}" @ ${authEvt.createdAt.toISOString()})` : " (none)") +
            `\n    → would add CAPTURE/CAPTURED $${Number(p.amount).toFixed(2)} ` +
            `providerRef=${p.providerPaymentIntentId} (createdAt backdated to capturedAt)`,
        );
        total += Number(p.amount);
      }
      console.log("─".repeat(84));
      console.log(`Total across affected payments: $${total.toFixed(2)} (audit rows only — no money moves)`);
    }

    if (!apply) {
      console.log("");
      console.log("DRY RUN — nothing written. Re-run with --apply to insert the missing CAPTURE events.");
      return;
    }

    if (payments.length === 0) {
      console.log("Nothing to write.");
      return;
    }

    let written = 0;
    for (const p of payments) {
      await prisma.paymentEvent.create({
        data: {
          paymentId: p.id,
          type: EnumPaymentEventType.CAPTURE,
          status: EnumPaymentEventStatus.CAPTURED,
          amount: p.amount,
          // Same providerRef convention as the live path and the webhook
          // (payment_intent id) — keeps future dedupe checks consistent.
          providerRef: p.providerPaymentIntentId,
          message:
            "Private customer payment captured immediately via Stripe at creation (backfilled audit event)",
          // Chronologically truthful position: the capture happened when
          // capturedAt was set, we are only recording it now. The backfill
          // marker lives in raw so the insertion time is never lost.
          createdAt: p.capturedAt ?? p.createdAt,
          raw: {
            source: "backfill-private-instant-capture",
            backfilledAt: new Date().toISOString(),
            deliveryId: p.delivery.id,
            customerId: p.delivery.customer.id,
            paymentType: p.paymentType,
            paymentIntentId: p.providerPaymentIntentId,
            note:
              "CAPTURE event was never recorded at creation (pre-ea9ffc2 code) and the " +
              "payment_intent.succeeded webhook never landed for this PaymentIntent",
          },
        },
      });
      written++;
      console.log(`  ✓ wrote CAPTURE event for payment ${p.id}`);
    }

    console.log("─".repeat(84));
    console.log(`Done. ${written} CAPTURE event(s) written. Re-running the script now finds nothing (idempotent).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ Backfill failed:", err?.message ?? err);
  process.exit(1);
});
