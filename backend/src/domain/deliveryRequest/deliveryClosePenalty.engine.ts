/**
 * DeliveryClosePenaltyEngine
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose: Handle the penalty fee + driver payout when a delivery is CLOSED
 *          (or cancelled) after a driver has committed to it (BOOKED or
 *          ACTIVE status) but the vehicle couldn't be moved.
 *
 * RULES (per product spec):
 *   • If the delivery is in BOOKED or ACTIVE status (a driver has accepted
 *     the job and is on the way / at the pickup location) AND the delivery
 *     is closed/cancelled because the vehicle cannot be moved → a base
 *     penalty fee is applied to the customer, and the driver receives a
 *     payout equal to the penalty fee.
 *   • If the delivery is in LISTED status (no driver has accepted yet) →
 *     no penalty, no driver payout. The driver hasn't committed any time
 *     to this delivery.
 *   • First 60 minutes of waiting = free. This rule is about the waiting
 *     time AFTER the driver arrives — it doesn't affect whether the
 *     penalty applies. The penalty is a flat fee for the driver's
 *     commitment (travel + arrival), not for waiting.
 *   • Admin cancels: the admin should be ASKED whether to apply the
 *     penalty fee. This engine exposes `previewClosePenalty` so the admin
 *     UI can show the choice, and `applyClosePenalty` accepts an explicit
 *     `applyPenalty` boolean. The admin cancel flow should NOT auto-apply.
 *   • Dealer close: auto-applies the penalty if the status is BOOKED/ACTIVE.
 *
 * LOOSE COUPLING:
 *   • The penalty amount is a single constant (CLOSE_PENALTY_FEE_DOLLARS)
 *     at the top of this file. Change it in one place.
 *   • This engine is injected into DeliveryLifecycleService and
 *     AdminDeliveryEngine. They call `applyClosePenalty` inside their
 *     existing transactions. No other service knows about the penalty.
 *   • If the product team decides to remove the penalty entirely, just
 *     stop calling this engine — no schema change needed.
 *
 * WHAT THIS ENGINE DOES NOT OWN:
 *   • The actual status transition (BOOKED/ACTIVE → CLOSED/CANCELLED).
 *     The caller does that.
 *   • Stripe refund logic for prepaid. The caller is responsible for
 *     releasing the original authorization hold; this engine only updates
 *     Payment.amount to the penalty amount (for postpaid invoicing) and
 *     captures the penalty (for prepaid, if a PaymentIntent exists).
 */

import { Injectable, Logger } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDriverPayoutStatus,
  EnumDriverPayoutType,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StripeService } from "../../providers/stripe/stripe.service";
import { businessNow } from "../../delivery-logistics/business-time";

/**
 * The base penalty fee applied when a delivery is closed/cancelled after
 * a driver has committed to it (BOOKED/ACTIVE) but the vehicle couldn't
 * be moved.
 *
 * Per product spec: $48. Change this single constant to adjust the fee.
 */
export const CLOSE_PENALTY_FEE_DOLLARS = 48;

/**
 * Preview result — returned to the admin UI so the admin can decide
 * whether to apply the penalty fee. Does NOT write anything.
 */
export interface ClosePenaltyPreview {
  /**
   * True if the delivery is in BOOKED or ACTIVE status — a driver has
   * committed to this delivery (accepted the job, is on the way or at
   * the pickup location). The penalty is warranted in this case.
   */
  driverCommitted: boolean;
  /** The penalty amount in dollars (null if driverCommitted is false) */
  penaltyAmountDollars: number | null;
  /** The penalty amount in cents (null if driverCommitted is false) */
  penaltyAmountCents: number | null;
  /** The driver who would receive the payout (null if no active assignment) */
  driverId: string | null;
  /**
   * What would happen if applyClosePenalty is called:
   *   - "apply_penalty"    → driver committed, penalty + driver payout will be applied
   *   - "no_penalty"       → no driver committed (LISTED status), no penalty, no payout
   *   - "no_driver"        → driver committed but no active driver assignment (no payout)
   */
  outcome: "apply_penalty" | "no_penalty" | "no_driver";
  /** Human-readable summary for the admin UI */
  summary: string;
}

export interface ApplyClosePenaltyInput {
  deliveryId: string;
  /**
   * For dealer close: pass `true` (auto-apply if PIN verified).
   * For admin cancel: the admin UI should pass the dealer's choice.
   * If `false`, no penalty is applied even if the PIN was verified
   * (the admin chose not to penalize).
   */
  applyPenalty: boolean;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
}

export interface ApplyClosePenaltyResult {
  applied: boolean;
  penaltyAmountDollars: number;
  driverPayoutId: string | null;
  paymentStatus: EnumPaymentStatus | null;
}

@Injectable()
export class DeliveryClosePenaltyEngine {
  private readonly logger = new Logger(DeliveryClosePenaltyEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService?: StripeService,
  ) {}

  /**
   * Preview what would happen if the penalty is applied.
   *
   * Called by the admin UI BEFORE the admin confirms the cancel — so the
   * admin can see "A driver has committed to this delivery, $48 penalty
   * will be applied to the dealer and paid to the driver. Apply penalty?"
   * with Yes/No buttons.
   *
   * Does NOT write anything. Safe to call multiple times.
   */
  async previewClosePenalty(deliveryId: string): Promise<ClosePenaltyPreview> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: { id: true, driverId: true },
        },
      },
    });

    if (!delivery) {
      return {
        driverCommitted: false,
        penaltyAmountDollars: null,
        penaltyAmountCents: null,
        driverId: null,
        outcome: "no_penalty",
        summary: "Delivery not found.",
      };
    }

    // A driver has "committed" to the delivery if the status is BOOKED
    // (driver accepted the job) or ACTIVE (driver is on the way / at
    // the pickup location). In these states, the driver has invested
    // time and effort — the penalty compensates them for that commitment.
    // In LISTED status, no driver has accepted yet → no penalty.
    const driverCommitted =
      delivery.status === EnumDeliveryRequestStatus.BOOKED ||
      delivery.status === EnumDeliveryRequestStatus.ACTIVE;
    const driverId = delivery.assignments[0]?.driverId ?? null;

    if (!driverCommitted) {
      return {
        driverCommitted: false,
        penaltyAmountDollars: null,
        penaltyAmountCents: null,
        driverId,
        outcome: "no_penalty",
        summary:
          "No driver has committed to this delivery yet (status is not BOOKED or ACTIVE). No penalty fee will be applied and the driver will not receive a payout.",
      };
    }

    if (!driverId) {
      return {
        driverCommitted: true,
        penaltyAmountDollars: CLOSE_PENALTY_FEE_DOLLARS,
        penaltyAmountCents: CLOSE_PENALTY_FEE_DOLLARS * 100,
        driverId: null,
        outcome: "no_driver",
        summary: `A driver has committed to this delivery (status: ${delivery.status}), but there is no active driver assignment. The $${CLOSE_PENALTY_FEE_DOLLARS} penalty fee can be applied to the customer, but no driver payout will be created.`,
      };
    }

    return {
      driverCommitted: true,
      penaltyAmountDollars: CLOSE_PENALTY_FEE_DOLLARS,
      penaltyAmountCents: CLOSE_PENALTY_FEE_DOLLARS * 100,
      driverId,
      outcome: "apply_penalty",
      summary: `A driver has committed to this delivery (status: ${delivery.status}). A $${CLOSE_PENALTY_FEE_DOLLARS} penalty fee will be applied to the customer and paid to the driver.`,
    };
  }

  /**
   * Apply (or skip) the penalty fee.
   *
   * MUST be called inside the caller's `prisma.$transaction` — accepts a
   * `tx` (Prisma transaction client) so all writes are atomic with the
   * status transition.
   *
   * For PREPAID:
   *   • If a PaymentIntent exists (providerPaymentIntentId set) and the
   *     original auth hold is still active, capture the penalty amount
   *     from the existing PI (partial capture). Release the rest.
   *   • If no PI exists (legacy / no hold), just update Payment.amount
   *     to the penalty amount and mark CAPTURED. No Stripe call.
   *   • Payment.status → CAPTURED, Payment.amount = penalty.
   *
   * For POSTPAID:
   *   • No Stripe call. Update Payment.amount to the penalty amount.
   *   • Payment.status stays as-is (AUTHORIZED if not yet reported,
   *     USAGE_REPORTED if already on the weekly invoice).
   *   • The reportUsageToStripe call (happens after the transaction
   *     commits, in the caller) will create the Stripe InvoiceItem for
   *     the penalty amount.
   *
   * Driver payout:
   *   • Creates a DriverPayout with type=CLOSE_PENALTY (re-using the
   *     ADJUSTMENT enum value to avoid a schema migration).
   *   • grossAmount = penalty, netAmount = penalty (driver gets 100%
   *     of the penalty per product spec — no platform fee on penalty).
   *   • status = PENDING for postpaid, ELIGIBLE for prepaid (paid
   *     immediately from the captured funds).
   *
   * Returns the result for audit logging.
   */
  async applyClosePenalty(
    tx: Prisma.TransactionClient,
    input: ApplyClosePenaltyInput,
  ): Promise<ApplyClosePenaltyResult> {
    const preview = await this.previewClosePenalty(input.deliveryId);

    // If the admin chose not to apply the penalty, or no driver has
    // committed (status is not BOOKED/ACTIVE), do nothing. The caller
    // still proceeds with the status transition (CLOSED/CANCELLED) — we
    // just don't touch payment/payout.
    if (!input.applyPenalty || !preview.driverCommitted) {
      return {
        applied: false,
        penaltyAmountDollars: 0,
        driverPayoutId: null,
        paymentStatus: null,
      };
    }

    const penaltyDollars = CLOSE_PENALTY_FEE_DOLLARS;
    const penaltyCents = penaltyDollars * 100;

    // ── Load payment + assignment in the transaction ──────────────────
    const delivery = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        payment: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            status: true,
            provider: true,
            providerPaymentIntentId: true,
          },
        },
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: { id: true, driverId: true },
        },
      },
    });

    if (!delivery) {
      throw new Error(`Delivery not found: ${input.deliveryId}`);
    }

    let paymentStatus: EnumPaymentStatus | null = null;

    // ── Update Payment row ────────────────────────────────────────────
    if (delivery.payment) {
      const payment = delivery.payment;
      const isPrepaid = payment.paymentType === EnumPaymentPaymentType.PREPAID;

      if (isPrepaid && payment.providerPaymentIntentId && this.stripeService) {
        // PREPAID with an active Stripe hold → partial capture of the penalty.
        // The rest of the hold is released automatically by Stripe's
        // `invoices.pay` / `paymentIntents.capture` with `amount_to_capture`.
        try {
          await this.stripeService.stripe.paymentIntents.capture(
            payment.providerPaymentIntentId,
            { amount_to_capture: penaltyCents },
          );
          paymentStatus = EnumPaymentStatus.CAPTURED;
        } catch (err: any) {
          // If capture fails (e.g. PI already canceled, or hold expired),
          // log and fall back to DB-only update. The admin can manually
          // reconcile via the refund endpoint.
          this.logger.error(
            `Failed to capture penalty for delivery ${input.deliveryId}: ${err?.message}`,
            err?.stack,
          );
          paymentStatus = EnumPaymentStatus.AUTHORIZED;
        }
      } else {
        // POSTPAID, or PREPAID without a PI (legacy) → DB-only update.
        // For postpaid, the InvoiceItem created at reportUsageToStripe
        // will use this updated amount.
        paymentStatus = isPrepaid
          ? EnumPaymentStatus.CAPTURED
          : (payment.status as EnumPaymentStatus);
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          amount: penaltyDollars,
          ...(paymentStatus ? { status: paymentStatus } : {}),
          ...(paymentStatus === EnumPaymentStatus.CAPTURED
            ? { capturedAt: businessNow().toJSDate() }
            : {}),
        },
      });

      // Write a PaymentEvent for audit.
      // PaymentEvent.status uses EnumPaymentEventStatus (a separate enum
      // from Payment.status which uses EnumPaymentStatus). Map the
      // payment status to the closest event status. The full context is
      // captured in the `raw` JSON field.
      const eventStatus = (
        paymentStatus === EnumPaymentStatus.CAPTURED ? "CAPTURED" :
        paymentStatus === EnumPaymentStatus.VOIDED ? "VOIDED" :
        paymentStatus === EnumPaymentStatus.AUTHORIZED ? "AUTHORIZED" :
        "AUTHORIZED"
      ) as any;

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: "AUTHORIZE" as any, // closest existing type; raw field carries the context
          status: eventStatus,
          message: `Close penalty applied: $${penaltyDollars.toFixed(2)} (pickup PIN verified). Reason: ${input.reason ?? "n/a"}`,
          raw: {
            event: "close_penalty_applied",
            oldAmount: payment.amount,
            newAmount: penaltyDollars,
            actorUserId: input.actorUserId ?? null,
            actorRole: input.actorRole ?? null,
          } as any,
        },
      });
    }

    // ── Create driver payout ──────────────────────────────────────────
    let driverPayoutId: string | null = null;
    const driverId = delivery.assignments[0]?.driverId ?? null;

    if (driverId) {
      const isPrepaid =
        delivery.payment?.paymentType === EnumPaymentPaymentType.PREPAID;
      const payoutStatus = isPrepaid
        ? EnumDriverPayoutStatus.ELIGIBLE
        : EnumDriverPayoutStatus.PENDING;

      // Upsert — if a payout already exists (e.g. lock-in fee from
      // startTrip), we DON'T overwrite it. We only create a payout if
      // one doesn't exist yet. This avoids clobbering a larger
      // completion payout with the smaller penalty amount.
      const existing = await tx.driverPayout.findUnique({
        where: { deliveryId: input.deliveryId },
        select: { id: true, type: true, netAmount: true },
      });

      if (!existing) {
        const payout = await tx.driverPayout.create({
          data: {
            deliveryId: input.deliveryId,
            driverId,
            grossAmount: penaltyDollars,
            insuranceFee: 0,
            platformFee: 0,
            netAmount: penaltyDollars,
            driverSharePct: 100, // driver gets 100% of the penalty
            status: payoutStatus,
            type: EnumDriverPayoutType.ADJUSTMENT, // re-using ADJUSTMENT; no schema migration needed
          },
          select: { id: true },
        });
        driverPayoutId = payout.id;
      } else {
        // A payout already exists (e.g. lock-in fee). Leave it as-is —
        // the existing payout may be larger than the penalty and we
        // don't want to reduce the driver's compensation.
        this.logger.log(
          `Delivery ${input.deliveryId} already has a ${existing.type} payout of $${existing.netAmount} — not overwriting with close penalty.`,
        );
        driverPayoutId = existing.id;
      }
    }

    return {
      applied: true,
      penaltyAmountDollars: penaltyDollars,
      driverPayoutId,
      paymentStatus,
    };
  }
}
