import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import { RefundSyncService } from "./refund-sync.service";

/**
 * RefundReconciliationService — the self-healing safety net for refunds
 * whose `charge.refunded` webhook never landed (Task 19).
 *
 * Production incident this exists for: an admin clicked refund, Stripe
 * issued it, but the webhook was not processed — so the Payment kept its
 * old status, the delivery showed no Refunded badge, the payments report
 * had no refunded row, and NOBODY was notified. Root cause of the silence:
 * the refund endpoint used to persist nothing, so there was nothing to
 * reconcile from.
 *
 * How it works:
 *   1. The admin refund endpoint now writes a PROCESSING PaymentEvent row
 *      (type REFUND, providerRef = Stripe refund id, raw.chargeId) the
 *      moment Stripe accepts the refund.
 *   2. Normally the charge.refunded webhook arrives within seconds and
 *      RefundSyncService upgrades the row to REFUNDED.
 *   3. This sweep runs every 10 minutes: any PROCESSING refund row older
 *      than 15 minutes is stale evidence of a lost webhook. It retrieves
 *      the charge from Stripe and runs the SAME RefundSyncService
 *      transition the webhook would have run — then closes the row and
 *      sends admins a notification that explicitly says the webhook was
 *      NOT received (so the Stripe Dashboard webhook health gets checked).
 *
 * If Stripe reports NO refunds on the charge (refund still pending /
 * failed at Stripe), the row is left open for the next tick.
 *
 * Kill switch: REFUND_RECONCILER_DISABLED=true.
 */
@Injectable()
export class RefundReconciliationService implements OnModuleInit, OnModuleDestroy {
  private static readonly TICK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
  private static readonly STALE_AFTER_MS = 15 * 60 * 1000; // webhook grace window
  private static readonly BATCH_SIZE = 20;

  private readonly logger = new Logger(RefundReconciliationService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
    @Optional() @Inject(RefundSyncService)
    private readonly refundSync?: RefundSyncService,
  ) {}

  onModuleInit(): void {
    if (process.env.REFUND_RECONCILER_DISABLED === "true") {
      this.logger.log("Refund reconciler disabled — REFUND_RECONCILER_DISABLED=true");
      return;
    }
    // First tick after 90s (give webhooks their normal window at boot),
    // then every 10 minutes. The timer never keeps the process alive.
    setTimeout(() => {
      void this.tick();
    }, 90_000).unref?.();
    this.timer = setInterval(() => {
      void this.tick();
    }, RefundReconciliationService.TICK_INTERVAL_MS);
    (this.timer as any)?.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) return; // previous tick still in flight
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - RefundReconciliationService.STALE_AFTER_MS);
      const stale = await this.prisma.paymentEvent.findMany({
        where: {
          type: "REFUND",
          status: "PROCESSING",
          createdAt: { lt: staleBefore },
        },
        take: RefundReconciliationService.BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });

      if (stale.length === 0) return;
      this.logger.warn(
        `${stale.length} refund event(s) still PROCESSING after ${RefundReconciliationService.STALE_AFTER_MS / 60000} min — reconciling from Stripe`,
      );

      for (const event of stale) {
        try {
          await this.reconcileOne(event);
        } catch (err: any) {
          this.logger.error(
            `Refund reconciliation failed for PaymentEvent ${event.id} (will retry next tick): ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Refund reconciler tick failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }

  private async reconcileOne(event: {
    id: string;
    paymentId: string;
    providerRef: string | null;
    raw: any;
  }): Promise<void> {
    if (!this.stripeService || !this.refundSync) {
      this.logger.warn("Refund reconciler: StripeService/RefundSyncService unavailable — skipping");
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: event.paymentId },
    });
    if (!payment) {
      // Payment gone (wipe/merge) — close the row so it stops churning.
      await this.prisma.paymentEvent.update({
        where: { id: event.id },
        data: {
          status: "REFUNDED",
          message: "Reconciler closed this refund audit row: the payment no longer exists.",
        },
      });
      return;
    }

    const chargeId = event.raw?.chargeId ?? null;
    if (!chargeId) {
      // Legacy/unknown shape — close the row with a note; nothing to query.
      await this.prisma.paymentEvent.update({
        where: { id: event.id },
        data: {
          status: "REFUNDED",
          message: "Reconciler closed this refund audit row: no charge reference stored (legacy row). Verify on Stripe if needed.",
        },
      });
      return;
    }

    const charge = await this.stripeService.stripe.charges.retrieve(chargeId, {
      expand: ["refunds"],
    });

    if (!charge.amount_refunded || charge.amount_refunded <= 0) {
      // Refund not reflected on Stripe yet (pending/failed) — leave open.
      this.logger.log(
        `Refund ${event.providerRef ?? event.id} for charge ${chargeId} not refunded on Stripe yet — leaving PROCESSING for next tick`,
      );
      return;
    }

    // Same transition the webhook runs — delta-computed from Stripe's
    // refund list, so if the webhook DID apply state late, this no-ops.
    const result = await this.refundSync.applyRefundState({
      payment,
      charge,
      // No Stripe event id here — RefundSyncService keys the clawback on
      // the refund id in reconciler mode.
      source: "reconciler",
    });

    this.logger.log(
      `Reconciled refund for payment ${payment.id}: delta $${(result.appliedDeltaCents / 100).toFixed(2)}, cumulative $${(result.cumulativeRefundedCents / 100).toFixed(2)}`,
    );
  }
}
