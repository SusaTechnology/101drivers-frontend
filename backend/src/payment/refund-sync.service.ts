import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";

/**
 * RefundSyncService — the SINGLE state-transition for customer refunds
 * (Task 19 extraction from StripeWebhookController.handleChargeRefunded).
 *
 * Given a Stripe charge that carries refunds, this service:
 *   1. Recomputes the cumulative customer-refunded total from Stripe's
 *      refund list (EXCLUDING referral-credit statement refunds, which are
 *      rewards, not customer refunds — see the referral-credit note below).
 *   2. Computes the DELTA vs the Payment row's refundedAmountCents.
 *   3. Atomically updates the Payment (refundedAmountCents, refundStatus,
 *      status REFUNDED on full refunds, refundedAt) and creates the
 *      proportional DriverPayoutAdjustment clawback.
 *   4. Upgrades the admin-refund-endpoint's PROCESSING timeline row to
 *      REFUNDED (or creates the completed timeline row when the endpoint
 *      row doesn't exist — legacy refunds / Stripe dashboard refunds).
 *   5. Notifies all admins (PAYMENT_REFUNDED bell + email) that the refund
 *      completed — with a distinct "webhook was NOT received" message when
 *      the reconciler had to apply the transition.
 *
 * Called from two places:
 *   • StripeWebhookController — the `charge.refunded` webhook (source
 *     "webhook"), keyed idempotent by the Stripe event id.
 *   • RefundReconciliationService — the self-healing sweep (source
 *     "reconciler") that picks up refunds whose webhook never landed,
 *     keyed idempotent by the refund id on the clawback.
 *
 * Both paths are safe to run concurrently and in any order: the delta is
 * recomputed from Stripe's refund list each time, so whichever path runs
 * second computes delta = 0 and becomes a no-op (beyond upgrading any
 * still-open PROCESSING timeline rows).
 */
@Injectable()
export class RefundSyncService {
  private readonly logger = new Logger(RefundSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
    @Optional() @Inject(NotificationEventEngine)
    private readonly notificationEngine?: NotificationEventEngine,
  ) {}

  /**
   * Apply refund state for a payment from a Stripe charge object.
   * Returns the applied delta in cents (0 = nothing new applied).
   */
  async applyRefundState(input: {
    payment: {
      id: string;
      deliveryId: string | null;
      amount: any;
      status: string;
      refundedAmountCents?: number | null;
      lockInChargeId?: string | null;
    };
    charge: any;
    /** Stripe event id when called from the webhook (idempotency key). */
    stripeEventId?: string;
    source: "webhook" | "reconciler";
  }): Promise<{ appliedDeltaCents: number; cumulativeRefundedCents: number }> {
    const { payment, charge } = input;

    // ── Compute the customer-refund totals from Stripe ──
    // `charge.amount_refunded` is CUMULATIVE (cents), but it INCLUDES
    // referral-credit statement refunds (metadata.source =
    // "referral-credit-autoapply"). Those reduce the dealer's charge as a
    // REWARD — they are not customer refunds, and counting them here would
    // create a FALSE driver clawback on an unrelated, fully-paid delivery.
    // So: recompute from the charge's refund list, excluding them.
    let customerRefundedCents = charge.amount_refunded || 0;
    let latestRefund: any = null;
    try {
      if (this.stripeService) {
        const refunds = await this.stripeService.stripe.refunds.list({
          charge: charge.id,
          limit: 100,
        });
        const customerRefunds = refunds.data.filter(
          (r: any) => r?.metadata?.source !== "referral-credit-autoapply",
        );
        customerRefundedCents = customerRefunds.reduce(
          (sum: number, r: any) => sum + (r.amount || 0),
          0,
        );
        // Stripe lists refunds newest-first, so the first entry is the one
        // the triggering event is about.
        latestRefund = customerRefunds[0] ?? null;
      }
    } catch (listErr: any) {
      // Fall back to the cumulative field (pre-referral-credit behavior) —
      // better to over-approximate than skip the refund entirely.
      this.logger.warn(
        `Could not list refunds for charge ${charge.id} (${listErr.message}) — using amount_refunded as-is`,
      );
    }
    // If the API list failed, the webhook payload's charge object usually
    // still carries the refunds list — use it for metadata before giving up.
    if (!latestRefund) {
      latestRefund =
        charge.refunds?.data?.find(
          (r: any) => r?.metadata?.source !== "referral-credit-autoapply",
        ) ?? null;
    }

    const cumulativeRefundedCents = customerRefundedCents;
    const totalAmountCents = Math.round(Number(payment.amount) * 100);
    const previousRefundedCents = payment.refundedAmountCents ?? 0;
    const deltaRefundedCents = Math.max(0, cumulativeRefundedCents - previousRefundedCents);
    const isFullRefund = cumulativeRefundedCents >= totalAmountCents;
    const refundStatus = isFullRefund
      ? "FULL"
      : cumulativeRefundedCents > 0
        ? "PARTIAL"
        : "NONE";

    // ── Atomic update + clawback creation (transactional) ──
    // Both the Payment.update and the DriverPayoutAdjustment.create
    // happen in the same transaction. If the clawback fails (e.g.,
    // unique constraint on stripeEventId for a duplicate), the Payment
    // update is rolled back too — no half-state.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            // Keep the legacy `status` field for backward compat — only
            // flip to REFUNDED when fully refunded. Partial refunds keep
            // the original status (CAPTURED) so existing code that reads
            // `status` continues to work.
            status: (isFullRefund ? "REFUNDED" : payment.status) as any,
            refundedAt: isFullRefund
              ? (payment as any).refundedAt ?? new Date()
              : (payment as any).refundedAt,
            providerChargeId: charge.id,
            refundedAmountCents: cumulativeRefundedCents,
            refundStatus,
          },
        });

        // Proportional driver clawback on the DELTA of this refund.
        // Idempotent via the unique constraint on stripeEventId (webhook
        // passes the evt_ id; the reconciler passes the re_ refund id —
        // each refund can therefore only ever produce ONE clawback row).
        if (deltaRefundedCents > 0) {
          try {
            await this.createDriverPayoutClawback(tx, {
              paymentId: payment.id,
              refundAmountCents: deltaRefundedCents,
              reason: "REFUND",
              // Reconciler has no event id — key on the refund id instead
              // so a webhook/reconciler race can never double-clawback.
              stripeEventId: input.stripeEventId ?? latestRefund?.id,
            });
          } catch (err: any) {
            if (
              err?.code === "P2002" &&
              Array.isArray(err?.meta?.target) &&
              err.meta.target.includes("stripeEventId")
            ) {
              this.logger.log(
                `DriverPayoutAdjustment for ${input.stripeEventId ?? latestRefund?.id} already exists (idempotent) — skipping`,
              );
            }
            // Rethrow either way: a P2002 aborts the tx (the Payment.update
            // above is a no-op rewrite in that case — same values), other
            // errors must fail loudly.
            throw err;
          }
        }
      });
    } catch (txErr: any) {
      if (
        txErr?.code === "P2002" &&
        Array.isArray(txErr?.meta?.target) &&
        txErr.meta.target.includes("stripeEventId")
      ) {
        // Duplicate webhook delivery / reconciler race — already processed.
        // Treat as success so Stripe stops retrying.
        this.logger.log(
          `Refund for payment ${payment.id} already processed (idempotent key ${input.stripeEventId ?? latestRefund?.id}) — skipping`,
        );
        await this.upgradeProcessingTimelineRows(payment.id, latestRefund, {
          completedMessage: null,
        });
        return { appliedDeltaCents: 0, cumulativeRefundedCents };
      }
      throw txErr;
    }

    // ── Payment Events timeline: upgrade the endpoint's PROCESSING row ──
    // The admin refund endpoint writes a PROCESSING row the moment Stripe
    // accepts the refund. Upgrade THAT row to completed so the timeline
    // shows one row per refund; only create a row when no open one exists
    // (refunds issued from the Stripe Dashboard / legacy flow).
    if (deltaRefundedCents > 0) {
      const meta = latestRefund?.metadata || {};
      const processedBy = meta.refundedBy ? ` Processed by ${meta.refundedBy}.` : "";
      const reason = meta.adminNote ? ` Reason: "${meta.adminNote}".` : "";
      const refundDollars = deltaRefundedCents / 100;
      const totalDollars = totalAmountCents / 100;
      const refundedToDateDollars = cumulativeRefundedCents / 100;
      const remainingDollars = Math.max(0, totalAmountCents - cumulativeRefundedCents) / 100;
      const detail = isFullRefund
        ? `Full refund completed — $${refundDollars.toFixed(2)} of $${totalDollars.toFixed(2)} returned to the dealer's card`
        : `Partial refund completed — $${refundDollars.toFixed(2)} of $${totalDollars.toFixed(2)} returned to the dealer's card ($${refundedToDateDollars.toFixed(2)} refunded to date, $${remainingDollars.toFixed(2)} still charged)`;
      const completedMessage = `${detail} (typically appears on their statement within 5–10 business days).${processedBy}${reason}${payment.lockInChargeId === charge.id ? " (on lock-in charge)" : ""}${input.source === "reconciler" ? " [confirmed via reconciliation — webhook not received]" : ""}`;

      await this.upgradeProcessingTimelineRows(payment.id, latestRefund, {
        completedMessage,
        stripeEventId: input.stripeEventId,
        charge,
      });
    } else {
      // Delta 0: state was already applied (duplicate event / race) — still
      // close any open PROCESSING rows so they don't dangle forever.
      await this.upgradeProcessingTimelineRows(payment.id, latestRefund, {
        completedMessage: null,
      });
    }

    // ── Admin notification (bell + email) ──
    // Tell admins a refund COMPLETED. This is the "message to admin" the
    // owner asked for: refund state is now on the delivery/payment, and a
    // driver clawback was queued. Reconciler-sourced notifications carry an
    // explicit warning that the Stripe webhook was not received.
    if (deltaRefundedCents > 0 && this.notificationEngine) {
      try {
        const meta = latestRefund?.metadata || {};
        await this.notificationEngine.notifyAdminsRefundProcessed({
          paymentId: payment.id,
          deliveryId: payment.deliveryId,
          refundAmount: deltaRefundedCents / 100,
          refundedToDate: cumulativeRefundedCents / 100,
          totalAmount: totalAmountCents / 100,
          isFullRefund,
          refundId: latestRefund?.id ?? null,
          refundedBy: meta.refundedBy ?? null,
          adminNote: meta.adminNote ?? null,
          source: input.source,
        });
      } catch (err: any) {
        // Non-fatal — the refund state itself is already applied.
        this.logger.error(
          `notifyAdminsRefundProcessed failed for payment ${payment.id} (non-fatal): ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Refund processed for payment ${payment.id} (${input.source}): delta $${(deltaRefundedCents / 100).toFixed(2)}, cumulative $${(cumulativeRefundedCents / 100).toFixed(2)} / $${(totalAmountCents / 100).toFixed(2)} (${refundStatus})`,
    );

    return { appliedDeltaCents: deltaRefundedCents, cumulativeRefundedCents };
  }

  /**
   * Upgrade the admin-refund-endpoint's PROCESSING PaymentEvent rows to
   * completed. Matched by (paymentId, type REFUND, status PROCESSING,
   * providerRef = refund id). When no open row matches the latest refund,
   * create the completed row idempotently by stripeEventId (webhook path).
   */
  private async upgradeProcessingTimelineRows(
    paymentId: string,
    latestRefund: any,
    opts: {
      completedMessage: string | null;
      stripeEventId?: string;
      charge?: any;
    },
  ) {
    try {
      if (latestRefund?.id) {
        // The refund this event is about → full completed message.
        const updated = await this.prisma.paymentEvent.updateMany({
          where: {
            paymentId,
            type: "REFUND",
            status: "PROCESSING",
            providerRef: latestRefund.id,
          },
          data: {
            status: "REFUNDED",
            message:
              opts.completedMessage ??
              "Refund confirmed on Stripe (already applied — duplicate delivery of the refund event).",
            ...(opts.stripeEventId ? { stripeEventId: opts.stripeEventId } : {}),
          },
        });
        if (updated.count > 0) return;
      }

      // No open endpoint row for this refund (Dashboard refund / legacy) —
      // create the completed row, idempotent per Stripe event id.
      if (opts.completedMessage) {
        await this.prisma.paymentEvent.create({
          data: {
            paymentId,
            type: "REFUND",
            status: "REFUNDED",
            amount: null,
            message: opts.completedMessage,
            providerRef: latestRefund?.id ?? opts.charge?.refunds?.data?.[0]?.id ?? null,
            raw: opts.charge ?? undefined,
            stripeEventId: opts.stripeEventId ?? null,
          },
        });
      }
    } catch (err: any) {
      // P2002 on stripeEventId = duplicate event row — harmless.
      if (err?.code !== "P2002") {
        this.logger.warn(
          `Timeline upgrade failed for payment ${paymentId} (non-fatal): ${err.message}`,
        );
      }
    }
  }

  // ── Driver payout clawback on refund (Fix #6, moved from webhook) ──
  //
  // When a customer gets their money back, the driver's payout for that
  // delivery is reduced proportionally. Otherwise the platform eats the
  // refund — the driver keeps their payout, the customer gets their money
  // back, and the platform loses twice.
  //
  //   clawback = -(refundAmount / totalAmount) × driverNet
  //
  // Idempotent via `stripeEventId` (unique constraint) — the webhook passes
  // the Stripe event id, the reconciler passes the refund id; either way
  // each refund can only produce ONE clawback row.
  //
  // Runs inside the caller's transaction so the clawback is atomic with
  // the Payment.update. PUBLIC: the charge.dispute.created handler reuses
  // it for the dispute clawback (same math, reason "DISPUTE").
  async createDriverPayoutClawback(
    tx: any,
    input: {
      paymentId: string;
      refundAmountCents: number;
      reason: string;
      stripeEventId?: string;
    },
  ): Promise<void> {
    if (input.refundAmountCents <= 0) return;

    // Find the original payout for this payment's delivery (inside
    // the same transaction for consistency).
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { deliveryId: true, amount: true },
    });
    if (!payment?.deliveryId) return;

    const payout = await tx.driverPayout.findUnique({
      where: { deliveryId: payment.deliveryId },
      select: { id: true, driverId: true, netAmount: true, driverSharePct: true },
    });
    if (!payout) {
      // No payout exists yet (e.g. refund before trip completion).
      // Skip — the payout will be created at completion, and we can't
      // claw back what doesn't exist yet. Admin can manually adjust.
      this.logger.log(
        `No DriverPayout found for delivery ${payment.deliveryId} — skipping clawback. ` +
          `Admin should manually adjust if a payout is created later.`,
      );
      return;
    }

    // Compute the proportional clawback. The driver's share of the
    // refund equals (refundAmount / totalAmount) × driverNet.
    const totalAmountCents = Math.round(Number(payment.amount) * 100);
    if (totalAmountCents <= 0) return;

    const refundRatio = input.refundAmountCents / totalAmountCents;
    const clawbackAmount = Number((Number(payout.netAmount) * refundRatio).toFixed(2));

    if (clawbackAmount <= 0) return;

    // Create the adjustment inside the transaction. The unique
    // constraint on `stripeEventId` makes this idempotent — if the
    // webhook is retried, the insert fails with P2002 (which the
    // caller catches and treats as a successful no-op).
    await tx.driverPayoutAdjustment.create({
      data: {
        driverId: payout.driverId,
        deliveryId: payment.deliveryId,
        paymentId: input.paymentId,
        originalPayoutId: payout.id,
        amount: -clawbackAmount, // negative = deduction from driver
        reason: input.reason,
        status: "PENDING",
        stripeEventId: input.stripeEventId ?? null,
        note: `Auto-clawback: ${input.reason} of $${(input.refundAmountCents / 100).toFixed(2)} (${(refundRatio * 100).toFixed(1)}% of $${(totalAmountCents / 100).toFixed(2)})`,
      },
    });

    this.logger.log(
      `Created DriverPayoutAdjustment for driver ${payout.driverId}: -$${clawbackAmount.toFixed(2)} ` +
        `(refund of $${(input.refundAmountCents / 100).toFixed(2)} on delivery ${payment.deliveryId})`,
    );
  }
}
