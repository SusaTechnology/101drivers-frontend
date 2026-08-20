import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { StripeService } from "../../providers/stripe/stripe.service";
import { DeliveryLifecycleService } from "../../delivery-logistics/delivery-lifecycle.service";
import { NotificationEventEngine, PricingEditNarrativeContext } from "../notificationEvent/notificationEvent.engine";
import { businessNow } from "../../delivery-logistics/business-time";

/**
 * DeliveryPricingEditEngine
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose: Handle dealer-initiated pricing/address edits on a delivery with
 *          proper Stripe reconciliation. This is a SEPARATE code path from the
 *          generic `PATCH /deliveryRequests/:id` so that the existing update
 *          flow (which has no payment reconciliation) remains untouched.
 *
 * Status policy (who can edit):
 *   Dealer-editable (no driver has accepted yet):
 *     - DRAFT     → just update DB (no Payment row exists yet)
 *     - QUOTED    → just update DB (no Payment row exists yet)
 *     - LISTED    → reconcile Stripe auth (cancel old + create new PI)
 *     - EXPIRED   → cancel stale auth, create new auth, reactivate to LISTED
 *
 *   Forbidden for dealer (driver has accepted — money is committed):
 *     - BOOKED    → driver claimed the delivery
 *     - ACTIVE    → driver is in transit (lock-in fee already captured)
 *
 *   Admin-only (terminal/post-money states — not exposed via this dealer endpoint):
 *     - COMPLETED → money captured, payout computed; use admin endpoints
 *     - CLOSED    → soft-completed; use admin endpoints
 *     - CANCELLED → terminal; use admin endpoints
 *     - DISPUTED  → under dispute; use admin endpoints
 *
 * Stripe strategy (the safe order):
 *   1. Create NEW PaymentIntent for the new total (manual capture, confirm).
 *      → If this FAILS, throw immediately. DB is NOT touched. The old PI is
 *        still active and the delivery is unchanged. The user sees a clear
 *        error message telling them what to do (save a card, retry, etc.).
 *   2. Run the DB transaction (update delivery row, payment row, audit event).
 *      → If this FAILS, we COMPENSATE by cancelling the new PI we just created
 *        (best-effort). The old PI is still active. Throw the DB error.
 *   3. Cancel the OLD PaymentIntent (best-effort, after DB success).
 *      → If this fails, log loudly — the new PI is the source of truth in the
 *        DB, but the customer may see a double-hold on their card statement
 *        for up to 7 days until Stripe auto-releases the old auth. An admin
 *        can manually cancel it in the Stripe dashboard.
 *
 *   This ordering guarantees:
 *     - Stripe failure → DB never updates ✓
 *     - DB failure → Stripe is compensated (new PI cancelled) ✓
 *     - Old-PI cancel failure → DB is correct, customer sees temp double-hold
 *
 *   POSTPAID: no Stripe call ever; just update Payment.amount in DB.
 *   Price unchanged (Δ ≈ 0): no Stripe call, just DB address update.
 *
 * Audit: every edit writes a PaymentEvent of type AUTHORIZE with the old/new
 * amounts and old/new PI ids in the `raw` field.
 */

/** Statuses a dealer can edit via this engine. */
const DEALER_EDITABLE_STATUSES: EnumDeliveryRequestStatus[] = [
  EnumDeliveryRequestStatus.DRAFT,
  EnumDeliveryRequestStatus.QUOTED,
  EnumDeliveryRequestStatus.LISTED,
  EnumDeliveryRequestStatus.EXPIRED,
];

/** Statuses that are forbidden for dealers (driver has accepted). */
const DEALER_FORBIDDEN_STATUSES: EnumDeliveryRequestStatus[] = [
  EnumDeliveryRequestStatus.BOOKED,
  EnumDeliveryRequestStatus.ACTIVE,
];

/** Statuses that require admin action (terminal/post-money). */
const ADMIN_ONLY_STATUSES: EnumDeliveryRequestStatus[] = [
  EnumDeliveryRequestStatus.COMPLETED,
  EnumDeliveryRequestStatus.CLOSED,
  EnumDeliveryRequestStatus.CANCELLED,
  EnumDeliveryRequestStatus.DISPUTED,
];

const EPSILON = 0.001; // dollars — treat sub-cent differences as "no change"

/**
 * Structured error codes the frontend can switch on to show the right popup.
 * The HTTP response body includes both `code` and `message` so the frontend
 * can render a precise, actionable dialog.
 */
export type PricingEditErrorCode =
  | "NO_SAVED_CARD"           // Customer has no Stripe customer / no saved PM
  | "CARD_DECLINED"            // Stripe returned requires_payment_method
  | "CARD_REQUIRES_ACTION"    // 3D Secure / bank approval needed
  | "STRIPE_API_ERROR"        // Generic Stripe API failure
  | "STRIPE_NOT_CONFIGURED"   // Server-side: StripeService not injected
  | "NEW_PI_FAILED_UNKNOWN"   // PI creation succeeded but status is unexpected
  | "COMPENSATION_FAILED"     // DB tx failed AND we couldn't cancel the new PI
  | "INVALID_STATUS";         // Delivery status doesn't allow dealer edit

export class PricingEditException extends BadRequestException {
  constructor(
    public readonly errorCode: PricingEditErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code: errorCode, message, details });
  }
}

export interface EditDeliveryPricingInput {
  deliveryId: string;
  /** ID of the freshly-generated Quote to attach. Caller must have called
   *  `POST /deliveryRequests/quote-preview` first with the new addresses. */
  newQuoteId: string;
  /** ID of the user initiating the edit (for audit). */
  actorUserId?: string | null;
  /** Role of the user initiating the edit (for audit). */
  actorRole?:
    | EnumDeliveryStatusHistoryActorRole
    | null;
  /** Human-readable reason for the edit (required for audit trail). */
  reason: string;
  /** When status is EXPIRED, re-list the delivery after editing.
   *  Default: true. Set to false to edit fields while keeping status EXPIRED
   *  (rarely useful — usually the dealer wants to re-list). */
  reactivateIfExpired?: boolean;
}

/**
 * Preview result for a pricing edit — does NOT modify the DB or call Stripe.
 * Returned by `previewPricingEdit()` and the `POST /:id/edit-pricing/preview`
 * endpoint. The frontend uses this to render a confirmation dialog showing
 * the price delta and a user-friendly "charge" or "release" message BEFORE
 * the dealer commits to the actual edit.
 */
export interface PreviewEditDeliveryPricingResult {
  deliveryId: string;
  status: EnumDeliveryRequestStatus;
  /** True if the dealer (or admin) is allowed to edit this delivery in its
   *  current status. False means the actual edit call would throw
   *  PricingEditException(INVALID_STATUS). The frontend should show the
   *  `notEditableReason` message and disable the submit button. */
  editable: boolean;
  /** Human-readable explanation when `editable` is false. */
  notEditableReason?: string;
  /** True if the caller (based on actorRole) is an admin who can override
   *  the ADMIN_ONLY_STATUSES gate. */
  isAdminOverride: boolean;
  oldQuoteId: string | null;
  newQuoteId: string;
  oldPrice: number | null;
  newPrice: number;
  priceDelta: number;
  /** "increase" | "decrease" | "unchanged" — drives the dialog message. */
  priceDirection: "increase" | "decrease" | "unchanged";
  /** What the engine WILL do on the actual edit call. */
  expectedStripeAction:
    | "none"
    | "reauthorized"
    | "skipped_postpaid"
    | "skipped_no_payment";
  /** User-facing headline — e.g. "Your new price is higher" or
   *  "Your new price is lower" or "Price unchanged". */
  headline: string;
  /** User-facing body — explains the charge/release in plain English with
   *  the delta in brackets, exactly as the dealer spec requires:
   *    increase → "It is going to charge you an additional price (new price − old price = $X.XX)."
   *    decrease → "The difference (old price − new price = $X.XX) will be released back to your card."
   *    unchanged → "No charge or release — your card is unaffected." */
  body: string;
  /** True if the delivery is EXPIRED and the edit will reactivate it. */
  willReactivate: boolean;
  /** Old + new addresses (so the dialog can show a summary diff). */
  oldPickupAddress: string;
  newPickupAddress: string;
  oldDropoffAddress: string;
  newDropoffAddress: string;
  /** Whether the customer is postpaid (no Stripe on the actual edit). */
  isPostpaid: boolean;
  /** Whether the delivery currently has a Payment row. */
  hasPayment: boolean;
}

export interface EditDeliveryPricingResult {
  deliveryId: string;
  status: EnumDeliveryRequestStatus;
  oldQuoteId: string | null;
  newQuoteId: string;
  oldPrice: number | null;
  newPrice: number;
  oldPaymentIntentId: string | null;
  newPaymentIntentId: string | null;
  priceChanged: boolean;
  stripeAction: "none" | "reauthorized" | "skipped_postpaid" | "skipped_no_payment";
  reactivated: boolean;
}

/**
 * Result of a best-effort PI cancellation. Richer than a boolean so callers
 * can write a useful audit trail and decide whether to alert ops.
 */
interface SafeCancelPiResult {
  /** True if the PI is no longer holding funds — either we cancelled it OR
   *  it was already in a terminal state (succeeded/captured/cancelled). */
  cancelled: boolean;
  /** True if the PI was already in a terminal state when we called cancel.
   *  In this case there was nothing to do — the customer was never going to
   *  be charged for this PI. */
  alreadyTerminal: boolean;
  /** True if the failure is transient (network blip, Stripe 5xx, rate limit)
   *  and a retry LATER (e.g. by the orphan-auth sweep cron) might succeed. */
  retryable: boolean;
  /** Human-readable message describing the outcome (success or error). */
  message: string;
}

@Injectable()
export class DeliveryPricingEditEngine {
  private readonly logger = new Logger(DeliveryPricingEditEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: DeliveryLifecycleService,
    private readonly notifications: NotificationEventEngine,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
  ) {}

  async editPricing(
    input: EditDeliveryPricingInput,
  ): Promise<EditDeliveryPricingResult> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new BadRequestException(
        "A reason is required for pricing edits (audit trail).",
      );
    }

    // ── 1. Load delivery + relations ────────────────────────────────────────
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            userId: true,
            businessName: true,
            contactName: true,
            customerType: true,
            postpaidEnabled: true,
            stripeCustomerId: true,
            stripeDefaultPaymentMethodId: true,
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                username: true,
              },
            },
          },
        },
        quote: {
          select: {
            id: true,
            estimatedPrice: true,
            pickupAddress: true,
            dropoffAddress: true,
            serviceType: true,
            pricingSnapshot: true,
            feesBreakdown: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            paymentType: true,
            providerPaymentIntentId: true,
            lockInAmount: true,
            lockInChargeId: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(
        `Delivery request '${input.deliveryId}' not found.`,
      );
    }

    // ── 2. Validate status ──────────────────────────────────────────────────
    this.assertDealerCanEdit(delivery.status, input.actorRole);

    // If EXPIRED but there's no Payment row, treat it like DRAFT (no Stripe work).
    const hasPayment = !!delivery.payment;
    const isPostpaid =
      delivery.payment?.paymentType === EnumPaymentPaymentType.POSTPAID;

    // ── 3. Load new quote + validate ────────────────────────────────────────
    const newQuote = await this.prisma.quote.findUnique({
      where: { id: input.newQuoteId },
      select: {
        id: true,
        estimatedPrice: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        pickupPlaceId: true,
        dropoffPlaceId: true,
        pickupState: true,
        dropoffState: true,
        serviceType: true,
        pricingSnapshot: true,
        feesBreakdown: true,
        distanceMiles: true,
        routePolyline: true,
        mileageCategory: true,
        pricingMode: true,
        estimatedDriverPayout: true,
      },
    });

    if (!newQuote) {
      throw new NotFoundException(
        `Quote '${input.newQuoteId}' not found.`,
      );
    }

    // ── 4. Compute price delta ──────────────────────────────────────────────
    const oldPrice: number | null = delivery.quote
      ? Number(delivery.quote.estimatedPrice)
      : null;
    const newPrice: number = Number(newQuote.estimatedPrice);
    const priceChanged =
      oldPrice == null || Math.abs(oldPrice - newPrice) > EPSILON;

    this.logger.log(
      `editPricing: delivery=${input.deliveryId} status=${delivery.status} ` +
        `oldPrice=${oldPrice} newPrice=${newPrice} priceChanged=${priceChanged} ` +
        `hasPayment=${hasPayment} isPostpaid=${isPostpaid}`,
    );

    // ── 5. Determine Stripe action ──────────────────────────────────────────
    let stripeAction: EditDeliveryPricingResult["stripeAction"] = "none";
    let newPaymentIntentId: string | null = null;
    const oldPaymentIntentId = delivery.payment?.providerPaymentIntentId ?? null;

    // DRAFT and QUOTED have no Payment row → no Stripe work.
    // LISTED/EXPIRED with no Payment row → also no Stripe work (orphan edge case).
    // POSTPAID → no Stripe call ever.
    // Price unchanged → no Stripe call (even if addresses changed).
    const needsStripeReauth =
      (delivery.status === EnumDeliveryRequestStatus.LISTED ||
        delivery.status === EnumDeliveryRequestStatus.EXPIRED) &&
      hasPayment &&
      !isPostpaid &&
      priceChanged;

    if (needsStripeReauth) {
      // ── 5a. Create NEW PI FIRST (Stripe call #1) ──────────────────────────
      // If this fails, we throw and the DB is never touched. The old PI is
      // still active and the delivery is unchanged.
      const narrative = this.buildNarrativeContext({
        delivery,
        newQuote,
        oldPrice,
        newPrice,
        oldPaymentIntentId,
        input,
      });
      const reauthResult = await this.createNewPiForReauth({
        delivery,
        newPrice,
        newQuoteId: newQuote.id,
        reason: input.reason,
        narrative,
      });
      newPaymentIntentId = reauthResult.paymentIntentId;

      // ── 5b. Run DB transaction (delivery + payment + audit) ───────────────
      // If this fails, we COMPENSATE by cancelling the new PI (best-effort).
      try {
        await this.persistEditInTransaction({
          delivery,
          newQuote,
          newPrice,
          newPaymentIntentId,
          oldPaymentIntentId,
          oldPrice,
          input,
          stripeAction: "reauthorized",
        });
      } catch (dbErr: any) {
        // COMPENSATION: cancel the new PI we just created so the customer
        // isn't left with a phantom authorization.
        this.logger.error(
          `editPricing: DB transaction failed for delivery ${input.deliveryId} ` +
            `after new PI ${newPaymentIntentId} was created. Attempting compensation ` +
            `(cancel new PI). DB error: ${dbErr?.message}`,
          dbErr?.stack,
        );

        // ── Durable audit: write a PaymentEvent row BEFORE attempting the
        //    compensation cancel. This guarantees that even if our process is
        //    killed mid-compensation (or the cancel itself crashes), there is
        //    a persistent record in the DB pointing at the orphaned PI id.
        //    The orphan-auth sweep cron can pick this up on the next run.
        //
        //    The row is written with `kind: "compensation_pending"` in `raw`.
        //    After the cancel attempt, we update `raw.kind` to either
        //    "compensation_completed" or "compensation_failed".
        // ───────────────────────────────────────────────────────────────────
        const paymentId = delivery.payment?.id;
        let compensationEventId: string | null = null;
        if (paymentId) {
          try {
            const event = await this.prisma.paymentEvent.create({
              data: {
                paymentId,
                type: EnumPaymentEventType.FAIL,
                status: EnumPaymentEventStatus.FAILED,
                amount: newPrice,
                message: `Pricing edit compensation: DB tx failed, attempting to cancel orphaned PI ${newPaymentIntentId}`,
                raw: {
                  kind: "compensation_pending",
                  deliveryId: input.deliveryId,
                  orphanedPaymentIntentId: newPaymentIntentId,
                  amount: newPrice,
                  dbError: dbErr?.message ?? String(dbErr),
                  reason: input.reason,
                  attemptedAt: businessNow().toISO(),
                } as any,
              },
            });
            compensationEventId = event.id;
          } catch (auditErr: any) {
            // If we can't even write the audit row, log loudly but proceed —
            // the Stripe cancel is still the most important action.
            this.logger.error(
              `editPricing: could not write compensation_pending PaymentEvent ` +
                `for delivery ${input.deliveryId} (DB may be down): ${auditErr?.message}`,
            );
          }
        }

        // ── Attempt the compensation cancel (with built-in retry). ─────────
        const cancelResult = await this.safeCancelPi(
          newPaymentIntentId,
          `compensation-for-db-failure-${input.deliveryId}`,
        );

        // ── Update the audit row with the outcome. ──────────────────────────
        if (compensationEventId) {
          try {
            await this.prisma.paymentEvent.update({
              where: { id: compensationEventId },
              data: {
                raw: {
                  kind: cancelResult.cancelled
                    ? "compensation_completed"
                    : "compensation_failed",
                  deliveryId: input.deliveryId,
                  orphanedPaymentIntentId: newPaymentIntentId,
                  amount: newPrice,
                  dbError: dbErr?.message ?? String(dbErr),
                  stripeCancelMessage: cancelResult.message,
                  stripeCancelRetryable: cancelResult.retryable,
                  stripeCancelAlreadyTerminal: cancelResult.alreadyTerminal,
                  completedAt: businessNow().toISO(),
                  reason: input.reason,
                } as any,
              },
            });
          } catch (auditErr: any) {
            this.logger.error(
              `editPricing: could not update compensation PaymentEvent ` +
                `${compensationEventId} with outcome: ${auditErr?.message}`,
            );
          }
        }

        if (!cancelResult.cancelled) {
          // Couldn't cancel the new PI either — the customer has a phantom auth.
          // This is a critical ops alert situation. Fire admin notification
          // (non-blocking — we don't want a notification failure to mask the
          // original error) and throw the structured exception.
          this.logger.error(
            `editPricing: COMPENSATION FAILED for delivery ${input.deliveryId}. ` +
              `New PI ${newPaymentIntentId} is still active on Stripe but the DB ` +
              `was not updated. An admin MUST manually cancel PI ${newPaymentIntentId} ` +
              `in the Stripe dashboard to release the customer's funds. ` +
              `Cancel error: ${cancelResult.message}`,
          );
          // Fire-and-forget admin email. If this throws, we still want the
          // PricingEditException to surface to the API caller.
          this.notifications
            .notifyAdminCompensationFailed({
              deliveryId: input.deliveryId,
              orphanedPaymentIntentId: newPaymentIntentId,
              amount: newPrice,
              dbError: dbErr?.message,
              stripeError: cancelResult.message,
              reason: input.reason,
              narrative: this.buildNarrativeContext({
                delivery,
                newQuote,
                oldPrice,
                newPrice,
                oldPaymentIntentId,
                input,
              }),
            })
            .catch((nErr: any) => {
              this.logger.error(
                `editPricing: admin notification for compensation failure also failed ` +
                  `(delivery ${input.deliveryId}, PI ${newPaymentIntentId}): ${nErr?.message}`,
              );
            });
          throw new PricingEditException(
            "COMPENSATION_FAILED",
            "We couldn't complete the pricing edit due to a database error, and we " +
              "couldn't cancel the temporary authorization on your card. Please " +
              "contact support immediately — they will cancel the pending charge and " +
              "help you complete the edit.",
            {
              deliveryId: input.deliveryId,
              orphanedPaymentIntentId: newPaymentIntentId,
              amount: newPrice,
              dbError: dbErr?.message,
              stripeCancelError: cancelResult.message,
              stripeCancelRetryable: cancelResult.retryable,
              paymentEventId: compensationEventId,
            },
          );
        }
        // Compensation succeeded — old PI is still active, new PI is cancelled.
        // Re-throw the original DB error so the caller sees what went wrong.
        throw dbErr;
      }

      stripeAction = "reauthorized";

      // ── 5c. Cancel OLD PI (best-effort, AFTER DB success) ─────────────────
      // If this fails, the DB is correct (new PI is source of truth) but the
      // customer may see a double-hold for up to 7 days. Log loudly for ops.
      // The orphan-auth sweep cron will eventually retry this cancel.
      if (oldPaymentIntentId) {
        const oldCancelResult = await this.safeCancelPi(
          oldPaymentIntentId,
          `pricing-edit-release-old-${input.deliveryId}`,
        );
        if (!oldCancelResult.cancelled) {
          this.logger.warn(
            `editPricing: Could not cancel old PI ${oldPaymentIntentId} for delivery ` +
              `${input.deliveryId} (cancel error: ${oldCancelResult.message}). ` +
              `The new PI ${newPaymentIntentId} is authorized and the DB is updated, ` +
              `but the customer may see a double-hold on their card for up to 7 days. ` +
              `The orphan-auth sweep cron will retry this cancel; an admin can also ` +
              `manually cancel PI ${oldPaymentIntentId} in the Stripe dashboard.`,
          );
        }
      }
    } else {
      // ── No Stripe reauth needed — just update the DB ──────────────────────
      if (!hasPayment) {
        stripeAction = "skipped_no_payment";
      } else if (isPostpaid) {
        stripeAction = "skipped_postpaid";
      } else {
        // Price unchanged but addresses may have changed
        stripeAction = "none";
      }

      await this.persistEditInTransaction({
        delivery,
        newQuote,
        newPrice,
        newPaymentIntentId: null,
        oldPaymentIntentId,
        oldPrice,
        input,
        stripeAction,
      });
    }

    // ── 6. Reactivate if EXPIRED ─────────────────────────────────────────────
    const shouldReactivate =
      delivery.status === EnumDeliveryRequestStatus.EXPIRED &&
      (input.reactivateIfExpired ?? true);

    let reactivated = false;
    if (shouldReactivate) {
      // State machine requires EXPIRED → QUOTED → LISTED (no direct EXPIRED → LISTED edge).
      this.logger.log(
        `editPricing: reactivating expired delivery ${input.deliveryId}`,
      );
      await this.lifecycle.transitionStatus(
        input.deliveryId,
        EnumDeliveryRequestStatus.QUOTED,
        {
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          actorType: EnumDeliveryStatusHistoryActorType.USER,
          note: `Reactivating from EXPIRED — pricing edit: ${input.reason}`,
        },
      );
      await this.lifecycle.transitionStatus(
        input.deliveryId,
        EnumDeliveryRequestStatus.LISTED,
        {
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          actorType: EnumDeliveryStatusHistoryActorType.USER,
          note: `Re-listed after pricing edit: ${input.reason}`,
        },
      );
      reactivated = true;
    }

    // ── 7. Return result ─────────────────────────────────────────────────────
    return {
      deliveryId: input.deliveryId,
      status: shouldReactivate
        ? EnumDeliveryRequestStatus.LISTED
        : delivery.status,
      oldQuoteId: delivery.quoteId,
      newQuoteId: newQuote.id,
      oldPrice,
      newPrice,
      oldPaymentIntentId,
      newPaymentIntentId,
      priceChanged,
      stripeAction,
      reactivated,
    };
  }

  // ── Public: preview (no side effects) ─────────────────────────────────────

  /**
   * Preview a pricing edit WITHOUT touching the DB or Stripe.
   *
   * Loads the delivery + new quote, computes the price delta, and returns
   * a structured result including a user-facing headline + body that the
   * frontend can render in a confirmation dialog.
   *
   * The headline + body are pre-built on the server (rather than the frontend)
   * so:
   *   1. The messaging is consistent across all callers (dealer-edit page,
   *      dealer-drafts page, admin edit, future mobile app).
   *   2. The delta math is done with the same `EPSILON` constant used by the
   *      actual edit, so the dialog never lies about whether a charge will
   *      happen.
   *   3. The dealer spec asked for very specific phrasing — "this new price
   *      minus old price" in brackets — and centralizing it guarantees we
   *      don't drift from that phrasing over time.
   *
   * This method NEVER throws PricingEditException for non-editable statuses.
   * Instead, it returns `editable: false` + `notEditableReason` so the
   * frontend can render the dialog with a disabled submit button (better UX
   * than a hard error — the dealer sees the price delta + the reason they
   * can't edit on the same screen).
   *
   * It DOES throw NotFoundException if the delivery or quote doesn't exist
   * (those are programmer errors, not user-facing state).
   */
  async previewPricingEdit(input: {
    deliveryId: string;
    newQuoteId: string;
    actorRole?:
      | EnumDeliveryStatusHistoryActorRole
      | null;
    reactivateIfExpired?: boolean;
  }): Promise<PreviewEditDeliveryPricingResult> {
    // ── Load delivery (minimal fields for preview) ──────────────────────────
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: {
          select: {
            id: true,
            postpaidEnabled: true,
          },
        },
        quote: {
          select: {
            id: true,
            estimatedPrice: true,
            pickupAddress: true,
            dropoffAddress: true,
          },
        },
        payment: {
          select: {
            id: true,
            paymentType: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(
        `Delivery request '${input.deliveryId}' not found.`,
      );
    }

    const newQuote = await this.prisma.quote.findUnique({
      where: { id: input.newQuoteId },
      select: {
        id: true,
        estimatedPrice: true,
        pickupAddress: true,
        dropoffAddress: true,
      },
    });

    if (!newQuote) {
      throw new NotFoundException(`Quote '${input.newQuoteId}' not found.`);
    }

    // ── Resolve editability + admin override ────────────────────────────────
    const actorRole = input.actorRole ?? null;
    const isAdmin =
      actorRole === EnumDeliveryStatusHistoryActorRole.ADMIN;

    const editableCheck = this.checkEditable(delivery.status, isAdmin);

    // ── Compute price delta + direction ─────────────────────────────────────
    const oldPrice: number | null = delivery.quote
      ? Number(delivery.quote.estimatedPrice)
      : null;
    const newPrice: number = Number(newQuote.estimatedPrice);
    const priceDelta =
      oldPrice == null ? newPrice : Math.round((newPrice - oldPrice) * 100) / 100;
    const priceDirection: "increase" | "decrease" | "unchanged" =
      oldPrice == null
        ? "increase" // going from "no price" to a price is effectively an increase
        : Math.abs(newPrice - oldPrice) <= EPSILON
          ? "unchanged"
          : newPrice > oldPrice
            ? "increase"
            : "decrease";

    // ── Determine the expected Stripe action (mirror editPricing logic) ────
    const hasPayment = !!delivery.payment;
    const isPostpaid =
      delivery.payment?.paymentType === EnumPaymentPaymentType.POSTPAID;

    const willReactivate =
      delivery.status === EnumDeliveryRequestStatus.EXPIRED &&
      (input.reactivateIfExpired ?? true);

    const needsStripeReauth =
      (delivery.status === EnumDeliveryRequestStatus.LISTED ||
        delivery.status === EnumDeliveryRequestStatus.EXPIRED) &&
      hasPayment &&
      !isPostpaid &&
      priceDirection !== "unchanged";

    const expectedStripeAction: PreviewEditDeliveryPricingResult["expectedStripeAction"] =
      !editableCheck.editable
        ? "none"
        : needsStripeReauth
          ? "reauthorized"
          : !hasPayment
            ? "skipped_no_payment"
            : isPostpaid
              ? "skipped_postpaid"
              : "none";

    // ── Build the user-facing headline + body ──────────────────────────────
    // The dealer spec asked for VERY specific phrasing:
    //   increase → "since addresses change this has price difference it is
    //               gonna charge you additional price and with bracket
    //               (this new price minus old price)"
    //   decrease → "this has a new price and since this is lower than the old
    //               price because you change addresses so the difference old
    //               price you authorized minus new one will be released"
    //
    // We mirror that phrasing here, with the actual dollar amounts filled in.
    const oldPriceStr =
      oldPrice == null ? "—" : `$${oldPrice.toFixed(2)}`;
    const newPriceStr = `$${newPrice.toFixed(2)}`;
    const deltaAbsStr = `$${Math.abs(priceDelta).toFixed(2)}`;

    let headline: string;
    let body: string;

    if (!editableCheck.editable) {
      headline = "This delivery can't be edited";
      body =
        editableCheck.reason === "driver_accepted"
          ? "A driver has already accepted this delivery, so pricing and addresses can no longer be changed. To make changes, cancel this delivery and create a new one, or contact support."
          : editableCheck.reason === "terminal_state"
            ? "This delivery has reached a final state (completed, closed, cancelled, or disputed) and can only be edited by an admin. Please contact an admin if you need to make changes."
            : "This delivery is in a state where pricing edits are not allowed.";
    } else if (priceDirection === "unchanged") {
      headline = "Price unchanged";
      body =
        "Since you changed the addresses, we recalculated the quote — but the new price is the same as the old one. No charge or release will happen on your card. " +
        `Old price: ${oldPriceStr} · New price: ${newPriceStr}.`;
    } else if (priceDirection === "increase") {
      headline = "Your new price is higher";
      if (!hasPayment) {
        // DRAFT — no Payment row yet, nothing to reconcile.
        body =
          `Since the addresses changed, the new price is higher than the old one. ` +
          `The new amount (${newPriceStr}) will be used when you place this delivery. ` +
          `Old price: ${oldPriceStr} → New price: ${newPriceStr} ` +
          `(additional ${deltaAbsStr}).`;
      } else if (isPostpaid) {
        // POSTPAID LISTED — no Stripe call, but the weekly invoice will
        // reflect the new amount when usage is reported at completion.
        body =
          `Since the addresses changed, the new price is higher than the old one. ` +
          `No charge is made right now — the new amount (${newPriceStr}) will appear on your next weekly postpaid invoice when this delivery is completed. ` +
          `Old price: ${oldPriceStr} → New price: ${newPriceStr} ` +
          `(additional ${deltaAbsStr}).`;
      } else {
        body =
          "Since the addresses changed, this has a price difference — it is going to charge you an additional price " +
          `(new price − old price = ${deltaAbsStr}). ` +
          `Old price: ${oldPriceStr} → New price: ${newPriceStr}. ` +
          "We'll place a new authorization on your card for the full new amount and release the old authorization. " +
          "You'll see the new hold on your card statement; the old one will disappear within a few business days.";
      }
    } else {
      // decrease
      headline = "Your new price is lower";
      if (!hasPayment) {
        // DRAFT — no Payment row yet, nothing to reconcile.
        body =
          `Since the addresses changed, the new price is lower than the old one. ` +
          `The new amount (${newPriceStr}) will be used when you place this delivery. ` +
          `Old price: ${oldPriceStr} → New price: ${newPriceStr} ` +
          `(${deltaAbsStr} less).`;
      } else if (isPostpaid) {
        // POSTPAID LISTED — no Stripe call, but the weekly invoice will
        // reflect the lower amount when usage is reported at completion.
        body =
          `Since the addresses changed, the new price is lower than the old one. ` +
          `No charge is made right now — the new, lower amount (${newPriceStr}) will appear on your next weekly postpaid invoice when this delivery is completed. ` +
          `Old price: ${oldPriceStr} → New price: ${newPriceStr} ` +
          `(${deltaAbsStr} less).`;
      } else {
        body =
          "Since the addresses changed, this has a new price — and because the new price is lower than the old one, " +
          `the difference (old price you authorized − new price = ${deltaAbsStr}) will be released back to your card. ` +
          `Old price: ${oldPriceStr} → New price: ${newPriceStr}. ` +
          "We'll place a new authorization for the new (lower) amount and release the old (higher) authorization. " +
          "The difference will reappear as available credit on your card within a few business days.";
      }
    }

    if (willReactivate) {
      body +=
        " Since this delivery had expired, it will be re-listed with the new price and addresses after you confirm.";
    }

    return {
      deliveryId: input.deliveryId,
      status: delivery.status,
      editable: editableCheck.editable,
      notEditableReason: editableCheck.editable
        ? undefined
        : editableCheck.reason,
      isAdminOverride: isAdmin && editableCheck.editable,
      oldQuoteId: delivery.quoteId,
      newQuoteId: newQuote.id,
      oldPrice,
      newPrice,
      priceDelta,
      priceDirection,
      expectedStripeAction,
      headline,
      body,
      willReactivate,
      oldPickupAddress: delivery.quote?.pickupAddress ?? delivery.pickupAddress,
      newPickupAddress: newQuote.pickupAddress,
      oldDropoffAddress:
        delivery.quote?.dropoffAddress ?? delivery.dropoffAddress,
      newDropoffAddress: newQuote.dropoffAddress,
      isPostpaid,
      hasPayment,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Pure function — check whether a delivery in the given status is editable
   * by the given actor. Does NOT throw. Returns `{ editable, reason }` so
   * both `previewPricingEdit` (returns the reason in the response body) and
   * `assertDealerCanEdit` (throws PricingEditException) can share the same
   * logic.
   *
   * Admin override:
   *   - DEALER_EDITABLE_STATUSES (DRAFT, QUOTED, LISTED, EXPIRED) → always editable.
   *   - DEALER_FORBIDDEN_STATUSES (BOOKED, ACTIVE) → NEVER editable, even by admin.
   *     A driver has accepted the trip and money is committed. Admin must use
   *     the cancellation/refund flow, NOT the pricing-edit flow.
   *   - ADMIN_ONLY_STATUSES (COMPLETED, CLOSED, CANCELLED, DISPUTED) → editable
   *     ONLY when `isAdmin === true`. Dealers get a "terminal state" error.
   */
  private checkEditable(
    status: EnumDeliveryRequestStatus,
    isAdmin: boolean,
  ): { editable: boolean; reason?: "driver_accepted" | "terminal_state" | "unknown" } {
    if (DEALER_EDITABLE_STATUSES.includes(status)) {
      return { editable: true };
    }
    if (DEALER_FORBIDDEN_STATUSES.includes(status)) {
      return { editable: false, reason: "driver_accepted" };
    }
    if (ADMIN_ONLY_STATUSES.includes(status)) {
      if (isAdmin) {
        return { editable: true };
      }
      return { editable: false, reason: "terminal_state" };
    }
    return { editable: false, reason: "unknown" };
  }

  /**
   * Assert the delivery status allows an edit by the given actor. Throws a
   * structured PricingEditException(INVALID_STATUS) with a clear, actionable
   * message.
   *
   * Admins (actorRole=ADMIN) can additionally edit ADMIN_ONLY_STATUSES
   * (COMPLETED, CLOSED, CANCELLED, DISPUTED) — they go through this same
   * engine so Stripe reconciliation, audit trail, and narrative notifications
   * are uniform across dealer-initiated and admin-initiated edits.
   *
   * BOOKED and ACTIVE are NEVER editable through this engine — a driver has
   * accepted the trip and money is committed. Admin must use the cancellation
   * / refund flow instead.
   */
  private assertDealerCanEdit(
    status: EnumDeliveryRequestStatus,
    actorRole?: EnumDeliveryStatusHistoryActorRole | null,
  ): void {
    const isAdmin = actorRole === EnumDeliveryStatusHistoryActorRole.ADMIN;
    const check = this.checkEditable(status, isAdmin);
    if (check.editable) {
      return;
    }

    if (check.reason === "driver_accepted") {
      throw new PricingEditException(
        "INVALID_STATUS",
        `This delivery is currently ${status} — a driver has already accepted it. ` +
          "Pricing edits are no longer allowed. If you need to change the pickup or " +
          "dropoff, please cancel this delivery and create a new one, or contact support.",
        { status, reason: "driver_accepted" },
      );
    }

    if (check.reason === "terminal_state") {
      throw new PricingEditException(
        "INVALID_STATUS",
        `This delivery is currently ${status} — it has reached a final state and ` +
          "cannot be edited by a dealer. Please contact an admin if you need to make changes.",
        { status, reason: "terminal_state" },
      );
    }

    throw new PricingEditException(
      "INVALID_STATUS",
      `This delivery is currently ${status} and cannot be edited.`,
      { status, reason: check.reason ?? "unknown" },
    );
  }

  /**
   * Create a NEW PaymentIntent for the reauthorization. If this fails for any
   * reason, throws a PricingEditException with a precise error code so the
   * frontend can show the right popup. The DB is NOT touched by this method.
   *
   * For SYSTEM-level failures (STRIPE_NOT_CONFIGURED, STRIPE_API_ERROR,
   * NEW_PI_FAILED_UNKNOWN), also fires an admin notification with a step-by-step
   * narrative so the admin knows exactly what the dealer tried and where the
   * system broke. User-card errors (NO_SAVED_CARD, CARD_DECLINED,
   * CARD_REQUIRES_ACTION) do NOT notify the admin — the dealer can resolve
   * those themselves via the PricingEditErrorDialog.
   */
  private async createNewPiForReauth(params: {
    delivery: {
      id: string;
      customer: {
        id: string;
        stripeCustomerId: string | null;
        stripeDefaultPaymentMethodId: string | null;
        user: { email: string | null } | null;
      };
    };
    newPrice: number;
    /** ID of the new quote the dealer is switching to. Used to derive a
     *  stable idempotency key for the Stripe call. */
    newQuoteId: string;
    reason: string;
    /** Pre-built narrative context for admin notifications. */
    narrative: PricingEditNarrativeContext;
  }): Promise<{ paymentIntentId: string; clientSecret: string }> {
    const { delivery, newPrice } = params;

    if (!this.stripeService) {
      // SYSTEM-LEVEL: StripeService not injected. Fire admin notification
      // so an admin knows pricing edits are broken server-wide.
      this.fireAdminSystemFailure(
        "STRIPE_NOT_CONFIGURED",
        "StripeService is not injected on this server — payment processing is unavailable.",
        { deliveryId: delivery.id, narrative: params.narrative, reason: params.reason },
      );
      throw new PricingEditException(
        "STRIPE_NOT_CONFIGURED",
        "Payment processing is not available on the server. Please contact support " +
          "before retrying.",
      );
    }

    const customer = delivery.customer;

    if (!customer.stripeCustomerId) {
      throw new PricingEditException(
        "NO_SAVED_CARD",
        "We couldn't find a saved card on your account. Please save a card under " +
          "Payment Methods first, then retry the edit.",
        { customerId: customer.id },
      );
    }

    // Resolve payment method (mirror the orchestrator's recovery logic).
    let paymentMethodId = customer.stripeDefaultPaymentMethodId;
    if (!paymentMethodId) {
      let attachedCards: any[] = [];
      try {
        attachedCards = await this.stripeService.listPaymentMethods(
          customer.stripeCustomerId,
        );
      } catch (err: any) {
        this.logger.error(
          `editPricing: Stripe listPaymentMethods failed for customer ${customer.id}: ${err.message}`,
          err.stack,
        );
        // SYSTEM-LEVEL: Stripe listPaymentMethods errored.
        this.fireAdminSystemFailure(
          "STRIPE_API_ERROR",
          `Stripe listPaymentMethods failed: ${err.message}`,
          {
            deliveryId: delivery.id,
            narrative: params.narrative,
            reason: params.reason,
            stripeError: err.message,
            stripeCode: err.code,
          },
        );
        throw new PricingEditException(
          "STRIPE_API_ERROR",
          "We couldn't retrieve your saved payment methods from Stripe. Please try again " +
            "in a moment, or contact support if the issue persists.",
          { customerId: customer.id, stripeError: err.message },
        );
      }
      if (!attachedCards || attachedCards.length === 0) {
        throw new PricingEditException(
          "NO_SAVED_CARD",
          "No saved payment method on file. Please save a card under Payment Methods " +
            "first, then retry the edit.",
          { customerId: customer.id },
        );
      }
      paymentMethodId = attachedCards[0].id;
      // Persist as default for next time.
      try {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { stripeDefaultPaymentMethodId: paymentMethodId },
        });
      } catch {
        // Non-fatal — we can still charge this time.
      }
    }

    // ── Create the new PaymentIntent ────────────────────────────────────────
    let newPI: { paymentIntentId: string; clientSecret: string; status?: string };
    try {
      newPI = await this.stripeService.createPaymentIntent({
        amount: newPrice,
        deliveryId: delivery.id,
        customerEmail: customer.user?.email || undefined,
        stripeCustomerId: customer.stripeCustomerId,
        paymentMethodId: paymentMethodId ?? undefined,
        captureMethod: "manual",
        confirm: true,
        // Stable idempotency key per (delivery, quote) pair — so if the dealer
        // retries the SAME edit (same quote, e.g. after a network blip), Stripe
        // dedupes the second call and returns the same PI. A different quote
        // produces a different key, allowing a new PI for a new edit.
        idempotencyKey: `pi-edit-${delivery.id}-${params.newQuoteId}`,
        metadata: {
          type: "pricing-edit-reauth",
          reason: params.reason.substring(0, 200),
        },
      });
    } catch (err: any) {
      this.logger.error(
        `editPricing: createPaymentIntent failed for delivery ${delivery.id}: ${err.message}`,
        err.stack,
      );
      // SYSTEM-LEVEL: Stripe createPaymentIntent errored.
      this.fireAdminSystemFailure(
        "STRIPE_API_ERROR",
        `Stripe createPaymentIntent failed: ${err.message}`,
        {
          deliveryId: delivery.id,
          narrative: params.narrative,
          reason: params.reason,
          stripeError: err.message,
          stripeCode: err.code,
          stripeDeclineCode: err.decline_code,
        },
      );
      throw new PricingEditException(
        "STRIPE_API_ERROR",
        "We couldn't authorize the new price on your card due to a Stripe error. " +
          "Your original authorization is still active — the delivery is unchanged. " +
          "Please try again, or contact support if the issue persists.",
        {
          deliveryId: delivery.id,
          stripeError: err.message,
          stripeCode: err.code,
          stripeDeclineCode: err.decline_code,
        },
      );
    }

    // ── Validate the new PI status ──────────────────────────────────────────
    const piStatus = newPI.status || "";
    if (piStatus === "requires_capture" || piStatus === "succeeded") {
      // Success — funds are held for the new amount.
      return {
        paymentIntentId: newPI.paymentIntentId,
        clientSecret: newPI.clientSecret,
      };
    }

    // PI didn't reach a holdable state — surface a precise, actionable error.
    // The old PI is still active; the new PI will be auto-released by Stripe.
    let code: PricingEditErrorCode;
    let message: string;
    if (piStatus === "requires_action") {
      code = "CARD_REQUIRES_ACTION";
      message =
        "Your bank needs you to approve this charge (3D Secure). The new price " +
          "was not authorized, but your original authorization is still active and " +
          "the delivery is unchanged. Please approve the charge with your bank and " +
          "retry the edit.";
    } else if (piStatus === "requires_payment_method") {
      code = "CARD_DECLINED";
      message =
        "Your saved card was declined for the new amount. The original authorization " +
          "is still active and the delivery is unchanged. Please save a different card " +
          "under Payment Methods and retry the edit.";
    } else {
      code = "NEW_PI_FAILED_UNKNOWN";
      message =
        `We couldn't authorize the new price (Stripe status: ${piStatus}). The ` +
          "original authorization is still active and the delivery is unchanged. " +
          "Please contact support if the issue persists.";
    }

    // Best-effort: cancel the failed new PI so it doesn't linger on Stripe.
    // (Stripe usually auto-releases these, but explicit cancel is cleaner.)
    // We don't write a PaymentEvent here because no Payment row points at
    // this PI yet — it was just created and never persisted.
    const failedCancelResult = await this.safeCancelPi(
      newPI.paymentIntentId,
      `pricing-edit-failed-status-${delivery.id}`,
    );
    if (!failedCancelResult.cancelled && !failedCancelResult.alreadyTerminal) {
      this.logger.warn(
        `editPricing: could not clean up failed PI ${newPI.paymentIntentId} ` +
          `for delivery ${delivery.id} (status=${piStatus}). Stripe will auto-release ` +
          `it after 7 days, but an admin may want to cancel it manually. ` +
          `Cancel error: ${failedCancelResult.message}`,
      );
    }

    // SYSTEM-LEVEL: PI came back in an unexpected status. Fire admin
    // notification so they can investigate (could indicate a Stripe API
    // contract change or a misconfigured account).
    if (code === "NEW_PI_FAILED_UNKNOWN") {
      this.fireAdminSystemFailure(
        "NEW_PI_FAILED_UNKNOWN",
        `Stripe returned PaymentIntent status '${piStatus}' (expected 'requires_capture'). PI id: ${newPI.paymentIntentId}`,
        {
          deliveryId: delivery.id,
          narrative: params.narrative,
          reason: params.reason,
          newPaymentIntentId: newPI.paymentIntentId,
          stripeError: `Unexpected PI status: ${piStatus}`,
        },
      );
    }

    throw new PricingEditException(code, message, {
      deliveryId: delivery.id,
      piStatus,
      newPaymentIntentId: newPI.paymentIntentId,
    });
  }

  /**
   * Persist the pricing edit in a single DB transaction. Updates the delivery
   * row (quote + addresses), the payment row (amount + PI id + status), and
   * writes a PaymentEvent audit row.
   */
  private async persistEditInTransaction(params: {
    delivery: {
      id: string;
      quoteId: string | null;
      payment: {
        id: string;
        amount: number;
        providerPaymentIntentId: string | null;
      } | null;
    };
    newQuote: {
      id: string;
      estimatedPrice: number;
      pickupAddress: string;
      pickupLat: number | null;
      pickupLng: number | null;
      pickupPlaceId: string | null;
      pickupState: string | null;
      dropoffAddress: string;
      dropoffLat: number | null;
      dropoffLng: number | null;
      dropoffPlaceId: string | null;
      dropoffState: string | null;
    };
    newPrice: number;
    newPaymentIntentId: string | null;
    oldPaymentIntentId: string | null;
    oldPrice: number | null;
    input: EditDeliveryPricingInput;
    stripeAction: string;
  }): Promise<void> {
    const {
      delivery,
      newQuote,
      newPrice,
      newPaymentIntentId,
      oldPaymentIntentId,
      oldPrice,
      input,
      stripeAction,
    } = params;

    await this.prisma.$transaction(async (tx) => {
      // Update delivery row with new quote + addresses from the new quote.
      await tx.deliveryRequest.update({
        where: { id: input.deliveryId },
        data: {
          quoteId: newQuote.id,
          pickupAddress: newQuote.pickupAddress,
          pickupLat: newQuote.pickupLat,
          pickupLng: newQuote.pickupLng,
          pickupPlaceId: newQuote.pickupPlaceId,
          pickupState: newQuote.pickupState,
          dropoffAddress: newQuote.dropoffAddress,
          dropoffLat: newQuote.dropoffLat,
          dropoffLng: newQuote.dropoffLng,
          dropoffPlaceId: newQuote.dropoffPlaceId,
          dropoffState: newQuote.dropoffState,
        },
      });

      // Update Payment row if it exists.
      if (delivery.payment) {
        const paymentUpdate: Prisma.PaymentUpdateInput = {
          amount: newPrice,
        };
        if (newPaymentIntentId) {
          paymentUpdate.providerPaymentIntentId = newPaymentIntentId;
          paymentUpdate.provider = EnumPaymentProvider.STRIPE;
          paymentUpdate.status = EnumPaymentStatus.AUTHORIZED;
          paymentUpdate.authorizedAt = businessNow().toJSDate();
        }
        await tx.payment.update({
          where: { id: delivery.payment.id },
          data: paymentUpdate,
        });

        // Write a PaymentEvent audit row.
        await tx.paymentEvent.create({
          data: {
            paymentId: delivery.payment.id,
            type: EnumPaymentEventType.AUTHORIZE,
            status: EnumPaymentStatus.AUTHORIZED,
            amount: newPrice,
            message: `Pricing edit: ${input.reason}`,
            raw: {
              oldQuoteId: delivery.quoteId,
              newQuoteId: newQuote.id,
              oldPrice,
              newPrice,
              oldPaymentIntentId,
              newPaymentIntentId,
              stripeAction,
              actorUserId: input.actorUserId ?? null,
              actorRole: input.actorRole ?? null,
              reason: input.reason,
              editedAt: businessNow().toISO(),
            } as any,
          },
        });
      }
    });
  }

  /**
   * Best-effort PI cancellation with retry + idempotency + error classification.
   *
   * WHY THIS EXISTS:
   *   The pricing edit engine creates a new PI first, then runs the DB tx. If
   *   the DB tx fails, we MUST cancel the new PI to release the customer's
   *   hold. If we DON'T cancel it, the customer has a phantom auth on their
   *   card for up to 7 days.
   *
   *   The original single-shot implementation could fail on transient errors
   *   (network blip, Stripe rate limit, Stripe 5xx) and leave the customer
   *   with a phantom auth even though a retry 1-2 seconds later would have
   *   succeeded. This implementation retries transient errors with
   *   exponential backoff before giving up.
   *
   * WHY COMPENSATION FAILURES ARE NEVER "OUR SYSTEM" FAILING:
   *   1. The PI id we're cancelling came back from Stripe's createPaymentIntent
   *      response — it's valid by construction.
   *   2. We pass a stable idempotency key (`cancel-${piId}`) so retries are
   *      deduped by Stripe — no double-counting.
   *   3. Transient errors (network, rate_limit, 5xx) are retried 3x with
   *      exponential backoff (1s, 2s, 4s) — total worst-case delay ~7s.
   *   4. Terminal-state errors (already cancelled, already captured) are
   *      treated as success — there's nothing to do.
   *   5. The ONLY way this returns `cancelled: false` is:
   *        a. StripeService is not injected (server misconfiguration — caught
   *           at startup, never happens in prod).
   *        b. The PI id doesn't exist on Stripe's side (`resource_missing`) —
   *           treated as alreadyTerminal, returns `cancelled: true`.
   *        c. ALL 3 retry attempts failed with transient errors — implies
   *           Stripe has been down or unreachable for ~7 seconds. This is
   *           external to our system; the orphan-auth sweep cron will retry
   *           again in 30 minutes, and the admin email fires immediately.
   *        d. A permanent Stripe error (authentication, permissions, account
   *           frozen) — external to our system; requires admin intervention.
   *
   * Never throws — callers can rely on a guaranteed return value.
   */
  private async safeCancelPi(
    paymentIntentId: string,
    idempotencyContext: string,
  ): Promise<SafeCancelPiResult> {
    if (!this.stripeService) {
      return {
        cancelled: false,
        alreadyTerminal: false,
        retryable: false,
        message:
          "StripeService is not injected on this server — payment processing is unavailable.",
      };
    }

    // Stable idempotency key — same key on every retry of THIS cancellation.
    // Stripe dedupes calls with the same idempotency key, so even if our
    // retry fires after Stripe already processed the cancel, we get back the
    // original (successful) response instead of an error.
    const idempotencyKey = `cancel-${paymentIntentId}`;

    const maxRetries = 3;
    const baseDelayMs = 1000; // 1 second — matches captureWithRetry pattern.

    let lastMessage = "Unknown error";
    let lastRetryable = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.stripeService.cancelPaymentIntentSafe(
        paymentIntentId,
        {
          idempotencyKey,
          cancellationReason: "abandoned",
        },
      );

      if (result.ok) {
        this.logger.log(
          `safeCancelPi: cancelled PI ${paymentIntentId} (${idempotencyContext})` +
            (attempt > 1 ? ` on attempt ${attempt}` : ""),
        );
        return {
          cancelled: true,
          alreadyTerminal: false,
          retryable: false,
          message: `Cancelled (status: ${result.status})`,
        };
      }

      if (result.alreadyTerminal) {
        // PI was already cancelled, captured, or succeeded. There's nothing
        // to do — treat as success because the customer isn't being held.
        this.logger.log(
          `safeCancelPi: PI ${paymentIntentId} is already in a terminal state ` +
            `(${idempotencyContext}): ${result.message}. Treating as success.`,
        );
        return {
          cancelled: true,
          alreadyTerminal: true,
          retryable: false,
          message: `Already terminal (${result.status}): ${result.message}`,
        };
      }

      // Failure — decide whether to retry.
      lastMessage = result.message;
      lastRetryable = result.retryable;

      if (!result.retryable || attempt === maxRetries) {
        // Permanent error, OR we exhausted retries on a transient error.
        this.logger.warn(
          `safeCancelPi: failed to cancel PI ${paymentIntentId} (${idempotencyContext}) ` +
            `after ${attempt} attempt(s): ${result.message} ` +
            `(retryable=${result.retryable}, code=${result.code ?? "n/a"}, ` +
            `statusCode=${result.statusCode ?? "n/a"})`,
        );
        return {
          cancelled: false,
          alreadyTerminal: false,
          retryable: result.retryable,
          message: result.message,
        };
      }

      // Transient error — backoff and retry.
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      this.logger.warn(
        `safeCancelPi: attempt ${attempt}/${maxRetries} failed for PI ${paymentIntentId} ` +
          `(${idempotencyContext}): ${result.message}. Retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Should be unreachable — the loop either returns or breaks out via the
    // `attempt === maxRetries` branch above. Keep a defensive fallback.
    return {
      cancelled: false,
      alreadyTerminal: false,
      retryable: lastRetryable,
      message: lastMessage,
    };
  }

  // ── Narrative context helpers ───────────────────────────────────────────

  /**
   * Build a PricingEditNarrativeContext from the loaded delivery data. Used
   * to pass dealer/price/quote/address context to the admin notifications
   * without making the notification engine re-fetch everything.
   *
   * The loaded delivery's `select` clause includes customer.businessName,
   * customer.contactName, and customer.user.{id, email, fullName, username},
   * so the engine can resolve the dealer + actor name directly. The
   * notification engine will still do its own DB lookup as a fallback if
   * any of these are missing.
   *
   * The narrative context is intentionally a flat, JSON-serializable object
   * so it can be embedded in the NotificationEvent.payload column.
   */
  private buildNarrativeContext(params: {
    delivery: {
      id: string;
      status: EnumDeliveryRequestStatus;
      customerId: string;
      quoteId: string | null;
      pickupAddress: string;
      dropoffAddress: string;
      customer: {
        id: string;
        userId: string;
        businessName: string | null;
        contactName: string | null;
        user: {
          id: string;
          email: string | null;
          fullName: string | null;
          username: string | null;
        } | null;
      };
      quote: {
        id: string;
        estimatedPrice: number;
        pickupAddress: string;
        dropoffAddress: string;
      } | null;
      payment: {
        providerPaymentIntentId: string | null;
      } | null;
    };
    newQuote: {
      id: string;
      estimatedPrice: number;
      pickupAddress: string;
      dropoffAddress: string;
    };
    oldPrice: number | null;
    newPrice: number;
    oldPaymentIntentId: string | null;
    input: EditDeliveryPricingInput;
  }): PricingEditNarrativeContext {
    const { delivery, newQuote, oldPrice, newPrice, oldPaymentIntentId, input } = params;
    const customer = delivery.customer;
    const user = customer?.user;

    return {
      // Prefer the explicit actorUserId from the input (the user who pressed
      // the button); fall back to the customer's attached user id.
      actorUserId: input.actorUserId ?? customer?.userId ?? undefined,
      // Resolve the actor (dealer) name. Prefer fullName, then username.
      actorName: user?.fullName ?? user?.username ?? undefined,
      actorEmail: user?.email ?? undefined,
      actorRole: input.actorRole ?? undefined,
      oldPrice: oldPrice ?? undefined,
      newPrice,
      oldQuoteId: delivery.quoteId ?? undefined,
      newQuoteId: newQuote.id,
      oldPaymentIntentId: oldPaymentIntentId ?? undefined,
      oldPickupAddress: delivery.quote?.pickupAddress ?? delivery.pickupAddress,
      oldDropoffAddress: delivery.quote?.dropoffAddress ?? delivery.dropoffAddress,
      newPickupAddress: newQuote.pickupAddress,
      newDropoffAddress: newQuote.dropoffAddress,
    };
  }

  /**
   * Fire-and-forget admin notification for a SYSTEM-level pricing edit
   * failure (STRIPE_NOT_CONFIGURED, STRIPE_API_ERROR, NEW_PI_FAILED_UNKNOWN).
   *
   * Never throws — if the notification itself fails, we just log it. The
   * PricingEditException that the caller throws afterward is the user-facing
   * error; the admin notification is best-effort.
   */
  private fireAdminSystemFailure(
    errorCode: PricingEditErrorCode,
    errorMessage: string,
    opts: {
      deliveryId: string;
      narrative: PricingEditNarrativeContext;
      reason?: string;
      newPaymentIntentId?: string | null;
      stripeError?: string;
      stripeCode?: string;
      stripeDeclineCode?: string;
    },
  ): void {
    // Only fire for system-level codes. User-card errors (NO_SAVED_CARD,
    // CARD_DECLINED, CARD_REQUIRES_ACTION) and INVALID_STATUS are NOT
    // system failures — the dealer can resolve them via the dialog.
    if (
      errorCode !== "STRIPE_NOT_CONFIGURED" &&
      errorCode !== "STRIPE_API_ERROR" &&
      errorCode !== "NEW_PI_FAILED_UNKNOWN"
    ) {
      return;
    }

    this.notifications
      .notifyAdminPricingEditSystemFailure({
        deliveryId: opts.deliveryId,
        errorCode,
        errorMessage,
        newPaymentIntentId: opts.newPaymentIntentId ?? null,
        stripeError: opts.stripeError,
        stripeCode: opts.stripeCode,
        stripeDeclineCode: opts.stripeDeclineCode,
        reason: opts.reason,
        narrative: opts.narrative,
      })
      .catch((nErr: any) => {
        this.logger.error(
          `editPricing: admin system-failure notification also failed ` +
            `(deliveryId=${opts.deliveryId}, errorCode=${errorCode}): ${nErr?.message}`,
        );
      });
  }
}
