import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from "@nestjs/common";
import {
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryToStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
  EnumQuoteServiceType,
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyServiceType,
  EnumUserRoles,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Logger } from "@nestjs/common";
import { TrackingGateway } from "../gateways/tracking.gateway";
import { GoogleMapsService } from "./google-maps.service";
import { PricingEngineService } from "./pricing-engine.service";
import { EmailVerificationService } from "../auth/email-verification/email-verification.service";
import { PasswordService } from "../auth/password.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { StripeService } from "../providers/stripe/stripe.service";
import { businessIsPastCutoff, businessIsSameDay, businessHourOf, businessNow } from "./business-time";

export type CreateDeliveryDraftFromQuoteInput = {
  customerId: string;
  // quoteId is OPTIONAL — when omitted, address fields below are used directly.
  quoteId?: string | null;
  serviceType: EnumDeliveryRequestServiceType;
  createdByUserId?: string | null;
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;
  customerChose?: EnumDeliveryRequestCustomerChose | null;
  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;
  licensePlate?: string | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  isUrgent?: boolean;
  afterHours?: boolean;
  vehicleStandardsConfirmed?: boolean | null;
  // ── Address fields (used when quoteId is NOT provided) ──
  pickupAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupPlaceId?: string | null;
  pickupState?: string | null;
  dropoffAddress?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffPlaceId?: string | null;
  dropoffState?: string | null;
};

export type CreateIndividualDeliveryDraftFromQuoteInput = {
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;

  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;

  savedVehicleId?: string | null;
  saveVehicleForFuture?: boolean;

  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;

  licensePlate?: string | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode?: string | null;

  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;

  isUrgent?: boolean;
  afterHours?: boolean;
  vehicleStandardsConfirmed?: boolean | null;
};

export type SchedulePreviewInput = {
  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;
  customerId?: string | null;
  customerChose?: EnumDeliveryRequestCustomerChose | null;
  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;
};

export type SchedulePreviewResult = {
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  dropoffWindowStart: Date | null;
  dropoffWindowEnd: Date | null;
  etaMinutes: number | null;
  bufferMinutes: number;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  afterHours: boolean;
  feasible: boolean;
  message?: string | null;
};

export type CreateQuotePreviewInput = {
  pickupAddress: string;
  dropoffAddress: string;
  serviceType: EnumDeliveryRequestServiceType;
  customerId?: string | null;
};

export type CreateDeliveryFromQuoteInput = {
  customerId: string;
  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;
  createdByUserId?: string | null;
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;
  customerChose?: EnumDeliveryRequestCustomerChose | null;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  dropoffWindowStart: Date;
  dropoffWindowEnd: Date;
  licensePlate: string;
  vehicleColor: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  isUrgent?: boolean;
  afterHours?: boolean;
  vehicleStandardsConfirmed?: boolean | null;
};

export type CreateIndividualDeliveryFromQuoteInput = {
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  otp?: string | null;
  password?: string | null;

  quoteId: string;
  serviceType: EnumDeliveryRequestServiceType;

  savedVehicleId?: string | null;
  saveVehicleForFuture?: boolean;

  pickupWindowStart?: Date | null;
  pickupWindowEnd?: Date | null;
  dropoffWindowStart?: Date | null;
  dropoffWindowEnd?: Date | null;

  licensePlate: string;
  vehicleColor: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode: string;

  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;

  isUrgent?: boolean;
  afterHours?: boolean;
  vehicleStandardsConfirmed?: boolean | null;
};

type IndividualCustomerShape = {
  id: string;
  userId: string | null;
  customerType: EnumCustomerCustomerType;
  stripeCustomerId: string | null;
  stripeDefaultPaymentMethodId: string | null;
  user: {
    id: string;
    email: string | null;
    emailVerifiedAt: Date | null;
    fullName: string | null;
    phone: string | null;
  } | null;
};

type ResolvedIndividualCustomerResult =
  | {
      kind: "READY";
      customer: IndividualCustomerShape;
    }
  | {
      kind: "VERIFICATION_REQUIRED";
      email: string;
      message: string;
    }
  | {
      kind: "LOGIN_REQUIRED";
      email: string;
      message: string;
    };

export type CreateIndividualDeliveryFromQuoteResult =
  | {
      action: "VERIFICATION_REQUIRED";
      email: string;
      message: string;
    }
  | {
      action: "LOGIN_REQUIRED";
      email: string;
      message: string;
    }
  | {
      action: "CREATED";
      deliveryId: string;
      delivery: unknown;
    };

@Injectable()
export class DeliveryRequestOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapsService: GoogleMapsService,
    private readonly pricingEngineService: PricingEngineService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordService: PasswordService,
    private readonly notificationEventEngine: NotificationEventEngine,
    @Optional() @Inject(StripeService) private readonly stripeService?: StripeService,
    @Optional() @Inject(forwardRef(() => TrackingGateway)) private readonly trackingGateway?: TrackingGateway,
  ) {
    const logger = new Logger(DeliveryRequestOrchestratorService.name);
    logger.log(
      `TrackingGateway ${this.trackingGateway ? 'INJECTED' : 'NOT INJECTED (undefined)'}`
    );
    // Critical: if StripeService is not injected, every prepaid delivery will
    // throw "Payment processing is not available on the server" from
    // attemptStripePrepaidCharge. Log it loudly at startup so we never again
    // ship with a broken DI token (the previous bug was @Inject("STRIPE_SERVICE")
    // — a string token that was never registered anywhere).
    logger.log(
      `StripeService ${this.stripeService ? 'INJECTED' : 'NOT INJECTED (undefined) — prepaid charges will FAIL'}`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Shared Stripe charge helper — used by BOTH create-from-quote paths.
  //
  // Behavior:
  //   • If `paymentType === PREPAID` (customer pays upfront):
  //       - Customer MUST have a saved card (stripeCustomerId + stripeDefaultPaymentMethodId).
  //         If not, throw BadRequestException with a message telling the dealer to save a card first.
  //       - Create a Stripe PaymentIntent with capture_method=manual + confirm=true.
  //         This silently authorizes the charge against the saved card. No UI prompt needed.
  //       - If Stripe returns an error (card declined, expired, RFI, etc.), throw a
  //         user-facing BadRequestException with the friendly reason.
  //       - Update the Payment row to provider=STRIPE + providerPaymentIntentId + status=AUTHORIZED.
  //
  //   • If `paymentType === POSTPAID` (business customer on monthly invoicing):
  //       - Leave provider=MANUAL. No charge now — the invoice lifecycle handles it.
  //
  //   • If Stripe is not configured (stripeService undefined or no secret key):
  //       - Throw a 500-style error so the dealer knows the platform is misconfigured.
  //         NEVER silently fall back to MANUAL — that's how free deliveries happen.
  //
  // Returns the clientSecret for the (rare) case where the caller wants to
  // expose it (e.g., for fallback UI). For saved-card flow, the secret is
  // not needed by the customer because confirmation is server-side.
  // ─────────────────────────────────────────────────────────────────
  private async attemptStripePrepaidCharge(params: {
    paymentId: string;
    amount: number;
    deliveryId: string;
    paymentType: EnumPaymentPaymentType;
    customer: {
      id: string;
      stripeCustomerId: string | null;
      stripeDefaultPaymentMethodId: string | null;
    };
    customerEmail?: string | null;
  }): Promise<{ paymentIntentId: string; clientSecret: string; status: string }> {
    // POSTPAID — no charge now, invoice later. Keep MANUAL.
    if (params.paymentType === EnumPaymentPaymentType.POSTPAID) {
      return { paymentIntentId: '', clientSecret: '', status: 'POSTPAID' };
    }

    // PREPAID — must actually charge via Stripe.
    if (!this.stripeService) {
      // Stripe not injected — the platform must be misconfigured. Never silently
      // fall back to MANUAL; that creates free deliveries. Throw so the dealer
      // sees the error and ops can fix the env.
      const errMsg = 'Payment processing is not available on the server. Please contact support before placing this delivery.';
      await this.markPaymentFailed(params.paymentId, errMsg, 'STRIPE_NOT_CONFIGURED');
      throw new BadRequestException(errMsg);
    }

    // ── Resolve which payment method to charge ──────────────────────────
    // Happy path: customer.stripeDefaultPaymentMethodId is set (webhook did its job).
    // Recovery path: stripeCustomerId is set but default is null (webhook didn't fire
    //   OR customer saved card before that webhook existed). Query Stripe for attached
    //   cards; if any exist, use the most recent AND persist it as the default so
    //   next time we skip this lookup.
    // Failure path: no stripeCustomerId OR no cards attached at all.
    let paymentMethodId = params.customer.stripeDefaultPaymentMethodId;
    const stripeCustomerId = params.customer.stripeCustomerId;

    if (!stripeCustomerId) {
      const errMsg =
        'No Stripe customer on file. Please save a card under Payment Methods first, then retry the delivery.';
      await this.markPaymentFailed(params.paymentId, errMsg, 'NO_STRIPE_CUSTOMER');
      throw new BadRequestException(errMsg);
    }

    if (!paymentMethodId) {
      // Auto-resolve: ask Stripe for attached cards.
      let attachedCards: any[] = [];
      try {
        attachedCards = await this.stripeService.listPaymentMethods(stripeCustomerId);
      } catch (err: any) {
        const friendly = this.translateStripeError(err);
        await this.markPaymentFailed(params.paymentId, friendly, 'STRIPE_LIST_PM_ERROR', err);
        throw new BadRequestException(friendly);
      }

      if (!attachedCards || attachedCards.length === 0) {
        const errMsg =
          'No saved payment method on file. Please save a card under Payment Methods first, then retry the delivery.';
        await this.markPaymentFailed(params.paymentId, errMsg, 'NO_SAVED_CARD');
        throw new BadRequestException(errMsg);
      }

      // Use the first (most recent) attached card.
      paymentMethodId = attachedCards[0].id;

      // Persist as default so future charges skip this lookup entirely.
      try {
        await this.prisma.customer.update({
          where: { id: params.customer.id },
          data: { stripeDefaultPaymentMethodId: paymentMethodId },
        });
      } catch {
        // Non-fatal — we can still charge this time even if persisting the default fails.
      }
    }

    let result: { paymentIntentId: string; clientSecret: string; status?: string };
    try {
      result = await this.stripeService.createPaymentIntent({
        amount: params.amount,
        deliveryId: params.deliveryId,
        customerEmail: params.customerEmail || undefined,
        stripeCustomerId,
        // By this point paymentMethodId is guaranteed to be a string (the
        // null/empty cases above throw early). Coerce to satisfy the
        // `string | undefined` signature in createPaymentIntent.
        paymentMethodId: paymentMethodId ?? undefined,
        // Saved card → confirm immediately, hold funds (manual capture).
        // Driver start-trip will partial-capture the lock-in fee;
        // completion will create a 2nd PI for the remainder.
        captureMethod: 'manual',
        confirm: true,
      });
    } catch (err: any) {
      // Stripe call failed — translate to a user-facing message and persist.
      const friendly = this.translateStripeError(err);
      await this.markPaymentFailed(params.paymentId, friendly, 'STRIPE_API_ERROR', err);
      throw new BadRequestException(friendly);
    }

    // Stripe succeeded — update the Payment row to STRIPE.
    // If PI status is requires_capture → funds are held (this is the happy path).
    // If PI status is requires_payment_method or requires_action → card needs
    // customer intervention; surface that as a clear error so dealer knows.
    const piStatus = result.status || '';
    if (piStatus === 'requires_capture' || piStatus === 'succeeded') {
      await this.prisma.payment.update({
        where: { id: params.paymentId },
        data: {
          provider: EnumPaymentProvider.STRIPE,
          providerPaymentIntentId: result.paymentIntentId,
          status: EnumPaymentStatus.AUTHORIZED,
          authorizedAt: businessNow().toJSDate(),
        },
      });
      return {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        status: piStatus,
      };
    }

    // PI is in a state that requires customer action (3DS, re-enter card, etc.)
    const friendly =
      piStatus === 'requires_action'
        ? 'Your bank needs you to approve this charge (3D Secure). Please contact your bank or use a different card.'
        : piStatus === 'requires_payment_method'
          ? 'Your saved card was declined or detached. Please save a new card under Payment Methods and retry.'
          : `Payment could not be completed (Stripe status: ${piStatus}). Please try a different card or contact support.`;

    await this.markPaymentFailed(
      params.paymentId,
      friendly,
      `PI_STATUS_${piStatus}`,
      { paymentIntentId: result.paymentIntentId, status: piStatus },
    );
    throw new BadRequestException(friendly);
  }

  // Persist a failure on the Payment row + create a FAILED PaymentEvent so
  // the dealer-facing UI can show "why did this delivery fail to charge?"
  private async markPaymentFailed(
    paymentId: string,
    message: string,
    code: string,
    raw?: any,
  ): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        provider: EnumPaymentProvider.STRIPE,
        status: EnumPaymentStatus.FAILED,
        failedAt: businessNow().toJSDate(),
        failureCode: code,
        failureMessage: message,
      },
    });
    await this.prisma.paymentEvent.create({
      data: {
        paymentId,
        type: EnumPaymentEventType.FAIL,
        status: EnumPaymentEventStatus.FAILED,
        amount: 0,
        message,
        raw: raw ?? { code },
      },
    });
  }

  // Translate Stripe SDK errors into customer-facing English. Falls back to
  // the raw message if we don't recognize the code.
  private translateStripeError(err: any): string {
    const code = err?.code || '';
    const declineCode = err?.decline_code || '';
    const msg = err?.message || 'Unknown payment error';

    // Common card-decline codes from Stripe
    if (code === 'card_declined' || declineCode) {
      switch (declineCode) {
        case 'insufficient_funds':
          return 'Your card was declined for insufficient funds. Please use a different card.';
        case 'expired_card':
          return 'Your card has expired. Please save a new card under Payment Methods.';
        case 'incorrect_cvc':
          return 'The security code on your card is incorrect. Please update your saved card.';
        case 'lost_card':
        case 'stolen_card':
          return 'Your card was reported lost or stolen. Please use a different card.';
        case 'do_not_honor':
          return 'Your bank declined the charge. Please call the number on your card to authorize it.';
        case 'generic_decline':
        default:
          return `Your card was declined${declineCode ? ` (${declineCode})` : ''}. Please use a different card.`;
      }
    }
    if (code === 'expired_card') {
      return 'Your card has expired. Please save a new card under Payment Methods.';
    }
    if (code === 'processing_error') {
      return 'An error occurred while processing your card. Please try again in a moment.';
    }
    if (code === 'incorrect_number') {
      return 'The card number is incorrect. Please save a new card under Payment Methods.';
    }
    if (err?.type === 'StripeAuthenticationError') {
      return 'Stripe authentication failed. Please verify your Stripe API keys are correct.';
    }
    if (err?.type === 'StripeConnectionError' || err?.type === 'APIConnectionError') {
      return 'Could not reach the payment processor. Please try again in a moment.';
    }
    if (err?.type === 'StripeInvalidRequestError') {
      return `Payment request was invalid: ${msg}. Please contact support.`;
    }
    return `Payment failed: ${msg}`;
  }

  // ─────────────────────────────────────────────────────────────────
  // Called when a charge fails AFTER the delivery row has been created.
  // Marks the delivery as CANCELLED with reason "Payment failed: <message>"
  // so it does NOT appear in the driver feed (drivers only see LISTED).
  // The dealer can retry by creating a new delivery with the same form data.
  //
  // Also writes a DeliveryStatusHistory row for the audit trail.
  // ─────────────────────────────────────────────────────────────────
  private async cancelDeliveryOnPaymentFailure(
    deliveryId: string,
    failureMessage: string,
    actorUserId?: string | null,
  ): Promise<void> {
    try {
      await this.prisma.deliveryRequest.update({
        where: { id: deliveryId },
        data: {
          status: EnumDeliveryRequestStatus.CANCELLED,
        },
      });

      await this.prisma.deliveryStatusHistory.create({
        data: {
          deliveryId,
          actorUserId: actorUserId ?? null,
          actorRole: null,
          actorType: EnumDeliveryStatusHistoryActorType.SYSTEM,
          fromStatus: EnumDeliveryStatusHistoryToStatus.LISTED,
          toStatus: EnumDeliveryStatusHistoryToStatus.CANCELLED,
          note: `Payment failed: ${failureMessage}`,
        },
      });
    } catch (err: any) {
      // Best-effort — don't shadow the original payment error
      // eslint-disable-next-line no-console
      console.error(
        `Failed to cancel delivery ${deliveryId} after payment failure: ${err.message}`,
      );
    }
  }

  /**
   * Release any prior DeliveryRequest (CANCELLED *or* DRAFT) that still holds
   * the given quoteId, so a new draft/real-delivery create doesn't 409 on
   * the quoteId `@unique` constraint.
   *
   * Background: `quoteId` is `@unique` in the Prisma schema. When a dealer
   * saves a DRAFT after calculating a quote, the DRAFT row holds that
   * quoteId. When they later promote the draft to a real delivery (or save
   * a new draft with the same quote), the new `deliveryRequest.create({
   * quoteId })` would hit:
   *   "Another record with the requested (quoteId) already exists" (409)
   *
   * This helper finds any CANCELLED or DRAFT delivery that still holds the
   * quoteId (owned by the same customer, defensively) and nulls out its
   * quoteId. The old row stays in the DB:
   *   - CANCELLED rows: kept for the audit trail
   *   - DRAFT rows: kept so the dealer can still find them in their drafts
   *     list (the frontend's onSuccess handler deletes them after the real
   *     delivery is created)
   * The quote itself is unaffected (its `id` is unchanged).
   *
   * Safe to call before any `deliveryRequest.create` that takes a quoteId.
   * No-op if no CANCELLED/DRAFT delivery holds the quoteId.
   */
  private async releasePriorQuoteId(
    quoteId: string,
    customerId: string,
  ): Promise<void> {
    try {
      const priorWithQuote = await this.prisma.deliveryRequest.findFirst({
        where: {
          quoteId,
          status: {
            in: [
              EnumDeliveryRequestStatus.CANCELLED,
              EnumDeliveryRequestStatus.DRAFT,
            ],
          },
          customerId,
        },
        select: { id: true, status: true },
      });

      if (priorWithQuote) {
        await this.prisma.deliveryRequest.update({
          where: { id: priorWithQuote.id },
          data: { quoteId: null },
        });
        const logger = new Logger(DeliveryRequestOrchestratorService.name);
        logger.log(
          `Released quoteId ${quoteId} from ${priorWithQuote.status} delivery ${priorWithQuote.id} (customer ${customerId}) so dealer can re-save`,
        );
      }
    } catch (err: any) {
      // Non-fatal — if this fails, the create below will throw a clearer
      // unique-constraint error. Log so we can diagnose.
      // eslint-disable-next-line no-console
      console.error(
        `Failed to release quoteId ${quoteId} from prior delivery: ${err.message}`,
      );
    }
  }

  async createDeliveryDraftFromQuote(input: CreateDeliveryDraftFromQuoteInput) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        userId: true,
        customerType: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // ── Resolve address fields ──
    // If quoteId is provided, fetch the quote and use its address fields
    // (existing behavior). If quoteId is NOT provided, use the address fields
    // from the payload directly — this lets dealers save a draft before
    // calculating a quote.
    let quoteData: {
      pickupAddress: string | null;
      pickupLat: number | null;
      pickupLng: number | null;
      pickupPlaceId: string | null;
      pickupState: string | null;
      dropoffAddress: string | null;
      dropoffLat: number | null;
      dropoffLng: number | null;
      dropoffPlaceId: string | null;
      dropoffState: string | null;
    } | null = null;

    if (input.quoteId) {
      const quote = await this.prisma.quote.findUnique({
        where: { id: input.quoteId },
        select: {
          id: true,
          pickupAddress: true,
          pickupLat: true,
          pickupLng: true,
          pickupPlaceId: true,
          pickupState: true,
          dropoffAddress: true,
          dropoffLat: true,
          dropoffLng: true,
          dropoffPlaceId: true,
          dropoffState: true,
          serviceType: true,
        },
      });

      if (!quote) {
        throw new NotFoundException("Quote not found");
      }
      quoteData = quote;
    }

    // Release any CANCELLED or prior DRAFT delivery that still holds this
    // quoteId (from a previous failed attempt or an earlier draft) so the
    // create below doesn't 409 on the unique constraint.
    if (input.quoteId) {
      await this.releasePriorQuoteId(input.quoteId, input.customerId);
    }

    const delivery = await this.prisma.deliveryRequest.create({
      data: {
        customerId: input.customerId,
        quoteId: input.quoteId ?? null,
        createdByUserId: input.createdByUserId ?? customer.userId ?? null,
        createdByRole: input.createdByRole ?? null,
        customerChose: input.customerChose ?? null,

        // Use quote address if available, otherwise fall back to payload fields.
        // pickupAddress / dropoffAddress are non-nullable in the Prisma schema
        // (String, not String?), so we use "" as the fallback when neither the
        // quote nor the payload provides a value. The dealer can fill in the
        // real address later when editing the draft.
        pickupAddress: quoteData?.pickupAddress ?? input.pickupAddress ?? "",
        pickupLat: quoteData?.pickupLat ?? input.pickupLat ?? null,
        pickupLng: quoteData?.pickupLng ?? input.pickupLng ?? null,
        pickupPlaceId: quoteData?.pickupPlaceId ?? input.pickupPlaceId ?? null,
        pickupState: quoteData?.pickupState ?? input.pickupState ?? null,

        dropoffAddress: quoteData?.dropoffAddress ?? input.dropoffAddress ?? "",
        dropoffLat: quoteData?.dropoffLat ?? input.dropoffLat ?? null,
        dropoffLng: quoteData?.dropoffLng ?? input.dropoffLng ?? null,
        dropoffPlaceId: quoteData?.dropoffPlaceId ?? input.dropoffPlaceId ?? null,
        dropoffState: quoteData?.dropoffState ?? input.dropoffState ?? null,

        pickupWindowStart: input.pickupWindowStart ?? null,
        pickupWindowEnd: input.pickupWindowEnd ?? null,
        dropoffWindowStart: input.dropoffWindowStart ?? null,
        dropoffWindowEnd: input.dropoffWindowEnd ?? null,

        etaMinutes: null,
        bufferMinutes: null,
        sameDayEligible: null,
        requiresOpsConfirmation: false,
        afterHours: input.afterHours === true,

        serviceType: input.serviceType,
        status: EnumDeliveryRequestStatus.DRAFT,

        licensePlate: input.licensePlate?.trim() || null,
        vehicleColor: input.vehicleColor?.trim() || null,
        vehicleMake: input.vehicleMake?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
        vinVerificationCode: input.vinVerificationCode?.trim() || null,

        // Vehicle standards attestation — optional for drafts, the attestation
        // is captured (or re-confirmed) when the draft is promoted to a real
        // delivery. We persist it here so the user doesn't have to re-check
        // the box if they already did.
        vehicleStandardsConfirmed: input.vehicleStandardsConfirmed === true,
        vehicleStandardsConfirmedAt:
          input.vehicleStandardsConfirmed === true ? new Date() : null,

        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        recipientPhone: input.recipientPhone?.trim() || null,

        isUrgent: input.isUrgent === true,
        pickupPin: this.generateIndividualPin(),
      },
      select: {
        id: true,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        actorUserId: input.createdByUserId ?? customer.userId ?? null,
        actorRole: input.createdByRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: null,
        toStatus: EnumDeliveryStatusHistoryToStatus.DRAFT,
        note: input.quoteId
          ? "Delivery draft created from quote"
          : "Delivery draft created (no quote yet)",
      },
    });

    return { id: delivery.id };
  }

  async createIndividualDeliveryDraftFromQuote(
    input: CreateIndividualDeliveryDraftFromQuoteInput
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        serviceType: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    let resolvedCustomerId: string | null = input.customerId ?? null;
    let resolvedCustomerUserId: string | null = null;

    if (!resolvedCustomerId && input.customerEmail) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          customerType: EnumCustomerCustomerType.PRIVATE,
          user: {
            email: input.customerEmail.trim().toLowerCase(),
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer.id;
        resolvedCustomerUserId = existingCustomer.userId ?? null;
      }
    }

    let vehicle = {
      licensePlate: input.licensePlate?.trim() || null,
      vehicleColor: input.vehicleColor?.trim() || null,
      vehicleMake: input.vehicleMake?.trim() || null,
      vehicleModel: input.vehicleModel?.trim() || null,
    };

    if (resolvedCustomerId && input.savedVehicleId) {
      const savedVehicle = await this.prisma.savedVehicle.findFirst({
        where: {
          id: input.savedVehicleId,
          customerId: resolvedCustomerId,
        },
        select: {
          licensePlate: true,
          color: true,
          make: true,
          model: true,
        },
      });

      if (savedVehicle) {
        vehicle = {
          licensePlate: savedVehicle.licensePlate,
          vehicleColor: savedVehicle.color,
          vehicleMake: savedVehicle.make,
          vehicleModel: savedVehicle.model,
        };
      }
    }

    if (!resolvedCustomerId) {
      throw new BadRequestException(
        "customerId is required for individual draft creation"
      );
    }

    // Release any CANCELLED *or* DRAFT delivery that still holds this quoteId
    // (from a previous failed attempt OR from a previously-saved draft) so
    // the draft create below doesn't 409 on the @unique constraint.
    //
    // We use releasePriorQuoteId (not just CANCELLED) because a dealer may
    // have already saved a DRAFT with this quoteId and is now re-saving it.
    await this.releasePriorQuoteId(input.quoteId, resolvedCustomerId);

    const delivery = await this.prisma.deliveryRequest.create({
      data: {
        customerId: resolvedCustomerId,
        quoteId: input.quoteId,
        createdByUserId: resolvedCustomerUserId,
        createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
        customerChose:
          input.pickupWindowStart && input.pickupWindowEnd
            ? EnumDeliveryRequestCustomerChose.PICKUP_WINDOW
            : input.dropoffWindowStart && input.dropoffWindowEnd
            ? EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW
            : null,

        pickupAddress: quote.pickupAddress,
        pickupLat: quote.pickupLat ?? null,
        pickupLng: quote.pickupLng ?? null,
        pickupPlaceId: quote.pickupPlaceId ?? null,
        pickupState: quote.pickupState ?? null,

        dropoffAddress: quote.dropoffAddress,
        dropoffLat: quote.dropoffLat ?? null,
        dropoffLng: quote.dropoffLng ?? null,
        dropoffPlaceId: quote.dropoffPlaceId ?? null,
        dropoffState: quote.dropoffState ?? null,

        pickupWindowStart: input.pickupWindowStart ?? null,
        pickupWindowEnd: input.pickupWindowEnd ?? null,
        dropoffWindowStart: input.dropoffWindowStart ?? null,
        dropoffWindowEnd: input.dropoffWindowEnd ?? null,

        etaMinutes: null,
        bufferMinutes: null,
        sameDayEligible: null,
        requiresOpsConfirmation: false,
        afterHours: input.afterHours === true,

        serviceType: input.serviceType,
        status: EnumDeliveryRequestStatus.DRAFT,

        licensePlate: vehicle.licensePlate,
        vehicleColor: vehicle.vehicleColor,
        vehicleMake: vehicle.vehicleMake,
        vehicleModel: vehicle.vehicleModel,
        vinVerificationCode: input.vinVerificationCode?.trim() || null,

        // Vehicle standards attestation — optional for drafts, the attestation
        // is captured (or re-confirmed) when the draft is promoted to a real
        // delivery. We persist it here so the user doesn't have to re-check
        // the box if they already did.
        vehicleStandardsConfirmed: input.vehicleStandardsConfirmed === true,
        vehicleStandardsConfirmedAt:
          input.vehicleStandardsConfirmed === true ? new Date() : null,

        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        recipientPhone: input.recipientPhone?.trim() || null,

        isUrgent: input.isUrgent === true,
        pickupPin: this.generateIndividualPin(),
      },
      select: {
        id: true,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        actorUserId: resolvedCustomerUserId,
        actorRole: EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: null,
        toStatus: EnumDeliveryStatusHistoryToStatus.DRAFT,
        note: "Individual delivery draft created from quote",
      },
    });

    return { id: delivery.id };
  }

  async createQuotePreview(input: CreateQuotePreviewInput) {
    const pickupGeo = await this.mapsService.validateCaliforniaAddressOrThrow(
      input.pickupAddress
    );

    const dropoffGeo = await this.mapsService.validateCaliforniaAddressOrThrow(
      input.dropoffAddress
    );

    const route = await this.mapsService.computeRouteMetrics({
      originLat: pickupGeo.lat,
      originLng: pickupGeo.lng,
      destinationLat: dropoffGeo.lat,
      destinationLng: dropoffGeo.lng,
    });

    return this.pricingEngineService.createQuote({
      pickupAddress: pickupGeo.formattedAddress,
      pickupLat: pickupGeo.lat,
      pickupLng: pickupGeo.lng,
      pickupPlaceId: pickupGeo.placeId ?? null,
      pickupState: pickupGeo.stateCode ?? null,

      dropoffAddress: dropoffGeo.formattedAddress,
      dropoffLat: dropoffGeo.lat,
      dropoffLng: dropoffGeo.lng,
      dropoffPlaceId: dropoffGeo.placeId ?? null,
      dropoffState: dropoffGeo.stateCode ?? null,

      distanceMiles: route.distanceMiles,
      routePolyline: route.polyline ?? null,
      serviceType: this.mapDeliveryServiceTypeToQuoteServiceType(
        input.serviceType
      ),
      customerId: input.customerId ?? null,
    });
  }

  async createIndividualDeliveryFromAcceptedQuote(
    input: CreateIndividualDeliveryFromQuoteInput
  ): Promise<CreateIndividualDeliveryFromQuoteResult> {
    const customerResolution =
      await this.resolveIndividualCustomerForCreate(input);

    if (customerResolution.kind === "VERIFICATION_REQUIRED") {
      return {
        action: "VERIFICATION_REQUIRED",
        email: customerResolution.email,
        message: customerResolution.message,
      };
    }

    if (customerResolution.kind === "LOGIN_REQUIRED") {
      return {
        action: "LOGIN_REQUIRED",
        email: customerResolution.email,
        message: customerResolution.message,
      };
    }

    const delivery = await this.createIndividualDeliveryForResolvedCustomer(
      customerResolution.customer,
      input
    );

    return {
      action: "CREATED",
      deliveryId: (delivery as any).id,
      delivery,
    };
  }

private async createIndividualDeliveryForResolvedCustomer(
  customer: IndividualCustomerShape,
  input: CreateIndividualDeliveryFromQuoteInput
) {
  const quote = await this.prisma.quote.findUnique({
    where: { id: input.quoteId },
    select: {
      id: true,
      estimatedPrice: true,
      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      pickupPlaceId: true,
      pickupState: true,
      dropoffAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffPlaceId: true,
      dropoffState: true,
      serviceType: true,
      pricingSnapshot: true,
      feesBreakdown: true,
    },
  });

  if (!quote) {
    throw new NotFoundException("Quote not found");
  }

  if (customer.customerType !== EnumCustomerCustomerType.PRIVATE) {
    throw new BadRequestException(
      "This endpoint is only for individual/private customers"
    );
  }

  if (!customer.user?.emailVerifiedAt) {
    throw new BadRequestException(
      "Email must be verified before creating a delivery request"
    );
  }

  if (!/^\d{4}$/.test(input.vinVerificationCode)) {
    throw new BadRequestException(
      "VIN verification code must be exactly 4 numeric digits"
    );
  }

  const resolvedVehicle = await this.resolveIndividualVehicleInput(
    customer.id,
    input
  );

  const routeMetrics =
    quote.pickupLat != null &&
    quote.pickupLng != null &&
    quote.dropoffLat != null &&
    quote.dropoffLng != null
      ? await this.mapsService.computeRouteMetrics({
          originLat: quote.pickupLat,
          originLng: quote.pickupLng,
          destinationLat: quote.dropoffLat,
          destinationLng: quote.dropoffLng,
        })
      : null;

  const policy =
    (await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType: EnumSchedulingPolicyCustomerType.PRIVATE,
        serviceType: this.mapDeliveryServiceTypeToSchedulingServiceType(
          input.serviceType
        ),
      },
      orderBy: { createdAt: "desc" },
    })) ??
    (await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType: EnumSchedulingPolicyCustomerType.PRIVATE,
        serviceType: null,
      },
      orderBy: { createdAt: "desc" },
    }));

  const bufferMinutes = policy?.bufferMinutes ?? 30;
  const etaMinutes = routeMetrics?.durationMinutes ?? 0;

  const schedule = this.resolveIndividualSchedule({
    pickupWindowStart: input.pickupWindowStart ?? null,
    pickupWindowEnd: input.pickupWindowEnd ?? null,
    dropoffWindowStart: input.dropoffWindowStart ?? null,
    dropoffWindowEnd: input.dropoffWindowEnd ?? null,
    etaMinutes,
    bufferMinutes,
  });

  const sameDayEligible = this.isSameDayEligible(
    schedule.pickupWindowStart,
    schedule.dropoffWindowEnd,
    etaMinutes,
    bufferMinutes,
    policy?.maxSameDayMiles ?? null,
    routeMetrics?.distanceMiles ?? null
  );

  // Hard-block same-day delivery creation after cutoff.
  // Only applies when the pickup is actually TODAY in business timezone.
  // A delivery for tomorrow or later should never be blocked by today's cutoff.
  const isSameDay = this.isSameCalendarDay(
    schedule.pickupWindowStart,
    schedule.dropoffWindowEnd
  );
  const isPickupToday = schedule.pickupWindowStart
    ? businessIsSameDay(schedule.pickupWindowStart, new Date())
    : false;
  if (isSameDay && isPickupToday) {
    const cutoffResult = this.enforceSameDayCutoff(policy);
    if (cutoffResult === 'blocked') {
      throw new BadRequestException(
        'Cutoff time has passed. No more same-day deliveries can be created today. Please choose a next-day delivery window.'
      );
    }
  }

  const requiresOpsConfirmation =
    policy?.requiresOpsConfirmation === true ||
    (input.afterHours === true && policy?.afterHoursEnabled !== true) ||
    (sameDayEligible === false &&
      this.isSameCalendarDay(
        schedule.pickupWindowStart,
        schedule.dropoffWindowEnd
      ));

  // Release any CANCELLED *or* DRAFT delivery that still holds this quoteId
  // before creating the new delivery, otherwise the create below will throw
  // a 409 "Another record with the requested (quoteId) already exists" and
  // the dealer's retry button won't work.
  //
  // We use releasePriorQuoteId (not just CANCELLED) because the individual
  // customer may have previously saved a DRAFT with this quoteId and is now
  // promoting it to a real delivery.
  await this.releasePriorQuoteId(input.quoteId, customer.id);

  const delivery = await this.prisma.deliveryRequest.create({
    data: {
      customerId: customer.id,
      quoteId: input.quoteId,
      createdByUserId: customer.userId,
      createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
      customerChose:
        input.pickupWindowStart && input.pickupWindowEnd
          ? EnumDeliveryRequestCustomerChose.PICKUP_WINDOW
          : EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW,

      pickupAddress: quote.pickupAddress,
      pickupLat: quote.pickupLat ?? null,
      pickupLng: quote.pickupLng ?? null,
      pickupPlaceId: quote.pickupPlaceId ?? null,
      pickupState: quote.pickupState ?? null,

      dropoffAddress: quote.dropoffAddress,
      dropoffLat: quote.dropoffLat ?? null,
      dropoffLng: quote.dropoffLng ?? null,
      dropoffPlaceId: quote.dropoffPlaceId ?? null,
      dropoffState: quote.dropoffState ?? null,

      pickupWindowStart: schedule.pickupWindowStart,
      pickupWindowEnd: schedule.pickupWindowEnd,
      dropoffWindowStart: schedule.dropoffWindowStart,
      dropoffWindowEnd: schedule.dropoffWindowEnd,

      etaMinutes: routeMetrics?.durationMinutes ?? null,
      bufferMinutes,
      sameDayEligible,
      requiresOpsConfirmation,
      afterHours: input.afterHours === true,

      serviceType: input.serviceType,
      status: EnumDeliveryRequestStatus.LISTED,

      licensePlate: resolvedVehicle.licensePlate,
      vehicleColor: resolvedVehicle.vehicleColor,
      vehicleMake: resolvedVehicle.vehicleMake,
      vehicleModel: resolvedVehicle.vehicleModel,
      vinVerificationCode: input.vinVerificationCode.trim(),

      // Vehicle standards attestation — REQUIRED for new deliveries (the
      // frontend blocks submission if the box is unchecked, but we don't
      // hard-fail here to avoid breaking legacy programmatic callers).
      // Stamp both the flag and the timestamp so insurers get an audit trail.
      vehicleStandardsConfirmed: input.vehicleStandardsConfirmed === true,
      vehicleStandardsConfirmedAt:
        input.vehicleStandardsConfirmed === true ? new Date() : null,

      recipientName: input.recipientName?.trim() || null,
      recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
      recipientPhone: input.recipientPhone?.trim() || null,

      isUrgent: input.isUrgent === true,
      trackingShareToken: null,
      trackingShareExpiresAt: null,
      pickupPin: this.generateIndividualPin(),
    },
    select: {
      id: true,
    },
  });

  await this.prisma.deliveryStatusHistory.create({
    data: {
      deliveryId: delivery.id,
      actorUserId: customer.userId,
      actorType: EnumDeliveryStatusHistoryActorType.USER,
      fromStatus: null,
      toStatus: EnumDeliveryStatusHistoryToStatus.LISTED,
      note: "Delivery created and listed on marketplace",
    },
  });

  await this.prisma.deliveryCompliance.create({
    data: {
      deliveryId: delivery.id,
      vinVerificationCode: input.vinVerificationCode.trim(),
    },
  });

  await this.prisma.trackingSession.create({
    data: {
      deliveryId: delivery.id,
    },
  });

  // Create the Payment row first as PENDING — the shared helper will update
  // it to STRIPE/AUTHORIZED on success, or to FAILED with a user-facing
  // message on failure. Either outcome is visible in the DB.
  const payment = await this.prisma.payment.create({
    data: {
      deliveryId: delivery.id,
      amount: quote.estimatedPrice,
      paymentType: EnumPaymentPaymentType.PREPAID,
      provider: EnumPaymentProvider.STRIPE,
      status: EnumPaymentStatus.AUTHORIZED,
      authorizedAt: businessNow().toJSDate(),
    },
  });

  // Attempt the actual Stripe charge against the saved card.
  // Throws BadRequestException with a friendly message on failure — the
  // customer sees the reason instead of getting a silent MANUAL fallback.
  // (Postpaid customers skip this and stay MANUAL; but the individual path
  //  is always PREPAID, so this always runs.)
  let paymentIntentId: string | null = null;
  let clientSecret: string | null = null;
  let piStatus: string | null = null;
  try {
    const result = await this.attemptStripePrepaidCharge({
      paymentId: payment.id,
      amount: quote.estimatedPrice,
      deliveryId: delivery.id,
      paymentType: EnumPaymentPaymentType.PREPAID,
      customer: {
        id: customer.id,
        stripeCustomerId: customer.stripeCustomerId,
        stripeDefaultPaymentMethodId: customer.stripeDefaultPaymentMethodId,
      },
      customerEmail: input.recipientEmail || customer.user?.email || null,
    });
    paymentIntentId = result.paymentIntentId;
    clientSecret = result.clientSecret;
    piStatus = result.status;
  } catch (err: any) {
    // Helper already wrote a FAILED PaymentEvent with the friendly message.
    // Mark the delivery as CANCELLED so it doesn't pollute the driver feed
    // (drivers only see LISTED). Then re-throw so the API layer surfaces
    // the error to the customer — the frontend shows a retry dialog.
    await this.cancelDeliveryOnPaymentFailure(
      delivery.id,
      err?.message || 'Unknown error',
      customer.userId ?? null,
    );
    throw err;
  }

  await this.prisma.paymentEvent.create({
    data: {
      paymentId: payment.id,
      type: EnumPaymentEventType.AUTHORIZE,
      status: EnumPaymentEventStatus.AUTHORIZED,
      amount: quote.estimatedPrice,
      message: "Prepaid payment authorized at individual request creation",
      raw: {
        source: "individual-create-from-quote",
        deliveryId: delivery.id,
        paymentIntentId,
        piStatus,
      },
    },
  });

  await this.notificationEventEngine.notifyDeliveryReleased({
    deliveryId: delivery.id,
    actorUserId: customer.userId ?? null,
  });

  // Do NOT send tracking link at creation time.
  // Only notify recipient that tracking will be shared after booking.
  if (input.recipientEmail || input.recipientPhone) {
    await this.notificationEventEngine.queueAndSend({
      actorUserId: customer.userId ?? null,
      customerId: customer.id,
      deliveryId: delivery.id,
      channel: input.recipientEmail
        ? EnumNotificationEventChannel.EMAIL
        : EnumNotificationEventChannel.SMS,
      type: EnumNotificationEventType.REMINDER,
      templateCode: "tracking-will-be-sent",
      subject: "Vehicle delivery scheduled",
      body: [
        `Hi ${input.recipientName ?? "Recipient"},`,
        "",
        "A vehicle delivery has been scheduled for you.",
        "Tracking will be shared once a driver is assigned.",
        "",
        "You will receive a tracking link when the trip begins.",
      ].join("\n"),
      toEmail: input.recipientEmail?.trim().toLowerCase() || null,
      toPhone: input.recipientPhone?.trim() || null,
      payload: {
        deliveryId: delivery.id,
      },
    });
  }

  if (input.saveVehicleForFuture === true) {
    await this.upsertSavedVehicleForCustomer(customer.id, {
      licensePlate: resolvedVehicle.licensePlate,
      make: resolvedVehicle.vehicleMake,
      model: resolvedVehicle.vehicleModel,
      color: resolvedVehicle.vehicleColor,
    });
  }

  // Emit socket events so driver feed and dealer dashboard update in real-time
  if (this.trackingGateway) {
    this.trackingGateway.emitNewDelivery({
      deliveryId: delivery.id,
      dealerId: customer.id,
      delivery: {
        id: delivery.id,
        status: "LISTED",
        pickupAddress: quote.pickupAddress,
        dropoffAddress: quote.dropoffAddress,
        pickupWindowStart: schedule.pickupWindowStart?.toISOString() ?? null,
        pickupWindowEnd: schedule.pickupWindowEnd?.toISOString() ?? null,
        createdAt: new Date().toISOString(),
      },
    });
    this.trackingGateway.emitFeedUpdate({ deliveryId: delivery.id, status: "LISTED" });
  }

  return this.prisma.deliveryRequest.findUniqueOrThrow({
    where: { id: delivery.id },
  });
}

private async resolveIndividualCustomerForCreate(
  input: CreateIndividualDeliveryFromQuoteInput
): Promise<ResolvedIndividualCustomerResult> {
  if (input.customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (!customer.user?.emailVerifiedAt) {
      if (customer.user?.email) {
        await this.emailVerificationService.requestVerification(
          customer.user.email,
          customer.user.fullName ?? null,
          "PRIVATE_CUSTOMER"
        );

        return {
          kind: "VERIFICATION_REQUIRED",
          email: customer.user.email,
          message: "Please verify your email before creating a delivery request.",
        };
      }

      throw new BadRequestException(
        "Customer email is missing and cannot be verified"
      );
    }

    if (
      customer.customerType === EnumCustomerCustomerType.PRIVATE &&
      customer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
    ) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          approvalStatus: EnumCustomerApprovalStatus.APPROVED,
          approvedAt: customer.approvedAt ?? businessNow().toJSDate(),
          approvedByUserId: null,
        },
      });
    }

    const normalizedCustomer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    return {
      kind: "READY",
      customer: normalizedCustomer,
    };
  }

  const customerEmail = input.customerEmail?.trim().toLowerCase() ?? null;
  const customerName = input.customerName?.trim() ?? null;
  const customerPhone = input.customerPhone?.trim() ?? null;
  const otp = input.otp?.trim() ?? null;
  const password = input.password ?? null;

  if (!customerEmail) {
    throw new BadRequestException("customerEmail is required");
  }

  const existingUser = await this.prisma.user.findUnique({
    where: { email: customerEmail },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      fullName: true,
      phone: true,
    },
  });

  if (existingUser) {
    if (existingUser.emailVerifiedAt) {
      return {
        kind: "LOGIN_REQUIRED",
        email: customerEmail,
        message:
          "An account already exists for this email. Please log in to continue.",
      };
    }

    if (!otp) {
      await this.emailVerificationService.requestVerification(
        customerEmail,
        customerName ?? existingUser.fullName ?? null,
        "PRIVATE_CUSTOMER"
      );

      return {
        kind: "VERIFICATION_REQUIRED",
        email: customerEmail,
        message:
          "Your email is not verified yet. We sent a verification code.",
      };
    }

    if (!password) {
      throw new BadRequestException(
        "password is required when completing email verification"
      );
    }

    await this.emailVerificationService.consumeTokenForEmail(
      customerEmail,
      otp
    );

    const hashedPassword = await this.passwordService.hash(password);

    const verifiedUser = await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerifiedAt: businessNow().toJSDate(),
        password: hashedPassword,
        fullName: customerName ?? existingUser.fullName ?? undefined,
        phone: customerPhone ?? existingUser.phone ?? undefined,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        fullName: true,
        phone: true,
      },
    });

    const existingCustomer = await this.prisma.customer.findUnique({
      where: { userId: verifiedUser.id },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (existingCustomer) {
      if (
        existingCustomer.customerType === EnumCustomerCustomerType.PRIVATE &&
        existingCustomer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
      ) {
        await this.prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            approvalStatus: EnumCustomerApprovalStatus.APPROVED,
            approvedAt: existingCustomer.approvedAt ?? businessNow().toJSDate(),
            approvedByUserId: null,
          },
        });
      }

      const normalizedExistingCustomer =
        await this.prisma.customer.findUniqueOrThrow({
          where: { id: existingCustomer.id },
          select: {
            id: true,
            userId: true,
            customerType: true,
            approvalStatus: true,
            approvedAt: true,
            approvedByUserId: true,
            stripeCustomerId: true,
            stripeDefaultPaymentMethodId: true,
            user: {
              select: {
                id: true,
                email: true,
                emailVerifiedAt: true,
                fullName: true,
                phone: true,
              },
            },
          },
        });

      return {
        kind: "READY",
        customer: normalizedExistingCustomer,
      };
    }

    const createdCustomer = await this.prisma.customer.create({
      data: {
        userId: verifiedUser.id,
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
        approvedAt: businessNow().toJSDate(),
        approvedByUserId: null,
        contactName: customerName ?? verifiedUser.fullName ?? "",
        contactEmail: customerEmail,
        contactPhone: customerPhone ?? verifiedUser.phone ?? "",
        phone: customerPhone ?? verifiedUser.phone ?? "",
      },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    return {
      kind: "READY",
      customer: createdCustomer,
    };
  }

  if (!customerName) {
    throw new BadRequestException(
      "customerName is required for new individual customers"
    );
  }

  if (!otp) {
    await this.emailVerificationService.requestVerification(
      customerEmail,
      customerName,
      "PRIVATE_CUSTOMER"
    );

    return {
      kind: "VERIFICATION_REQUIRED",
      email: customerEmail,
      message: "Please verify your email before creating a delivery request.",
    };
  }

  if (!password) {
    throw new BadRequestException(
      "password is required when completing email verification"
    );
  }

  await this.emailVerificationService.consumeTokenForEmail(
    customerEmail,
    otp
  );

  const hashedPassword = await this.passwordService.hash(password);

  const user = await this.prisma.user.create({
    data: {
      email: customerEmail,
      username: this.generateUsernameFromEmail(customerEmail),
      password: hashedPassword,
      roles: EnumUserRoles.PRIVATE_CUSTOMER,
      fullName: customerName,
      phone: customerPhone ?? null,
      isActive: true,
      emailVerifiedAt: businessNow().toJSDate(),
    },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      fullName: true,
      phone: true,
    },
  });

  const customer = await this.prisma.customer.create({
    data: {
      userId: user.id,
      customerType: EnumCustomerCustomerType.PRIVATE,
      approvalStatus: EnumCustomerApprovalStatus.APPROVED,
      approvedAt: businessNow().toJSDate(),
      approvedByUserId: null,
      contactName: customerName,
      contactEmail: customerEmail,
      contactPhone: customerPhone ?? "",
      phone: customerPhone ?? "",
    },
    select: {
      id: true,
      userId: true,
      customerType: true,
      approvalStatus: true,
      approvedAt: true,
      approvedByUserId: true,
      stripeCustomerId: true,
      stripeDefaultPaymentMethodId: true,
      user: {
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          fullName: true,
          phone: true,
        },
      },
    },
  });

  return {
    kind: "READY",
    customer,
  };
}

  private generateIndividualPin(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  private generateUsernameFromEmail(email: string): string {
    const base = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");
    return `${base}_${Date.now()}`;
  }

  private async resolveIndividualVehicleInput(
    customerId: string,
    input: CreateIndividualDeliveryFromQuoteInput
  ) {
    if (!input.savedVehicleId) {
      return {
        licensePlate: input.licensePlate.trim(),
        vehicleColor: input.vehicleColor.trim(),
        vehicleMake: input.vehicleMake?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
      };
    }

    const savedVehicle = await this.prisma.savedVehicle.findFirst({
      where: {
        id: input.savedVehicleId,
        customerId,
      },
      select: {
        id: true,
        make: true,
        model: true,
        color: true,
        licensePlate: true,
      },
    });

    if (!savedVehicle) {
      throw new NotFoundException("Saved vehicle not found");
    }

    return {
      licensePlate: savedVehicle.licensePlate,
      vehicleColor: savedVehicle.color,
      vehicleMake: savedVehicle.make,
      vehicleModel: savedVehicle.model,
    };
  }

  async createDeliveryFromAcceptedQuote(input: CreateDeliveryFromQuoteInput) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        postpaidEnabled: true,
        // Needed by the Stripe charge helper:
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        contactEmail: true,
        user: { select: { email: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        estimatedPrice: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        serviceType: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    if (!/^\d{4}$/.test(input.vinVerificationCode)) {
      throw new BadRequestException(
        "VIN verification code must be exactly 4 numeric digits"
      );
    }

    this.assertScheduleWindows(input);

    const policyCustomerType =
      customer.customerType === EnumCustomerCustomerType.BUSINESS
        ? EnumSchedulingPolicyCustomerType.BUSINESS
        : EnumSchedulingPolicyCustomerType.PRIVATE;

    const policyServiceType =
      this.mapDeliveryServiceTypeToSchedulingServiceType(input.serviceType);

    const policy =
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: policyServiceType,
        },
        orderBy: { createdAt: "desc" },
      })) ??
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: null,
        },
        orderBy: { createdAt: "desc" },
      }));

    const routeMetrics =
      quote.pickupLat != null &&
      quote.pickupLng != null &&
      quote.dropoffLat != null &&
      quote.dropoffLng != null
        ? await this.mapsService.computeRouteMetrics({
            originLat: quote.pickupLat,
            originLng: quote.pickupLng,
            destinationLat: quote.dropoffLat,
            destinationLng: quote.dropoffLng,
          })
        : null;

    const bufferMinutes = policy?.bufferMinutes ?? 30;

    const sameDayEligible = this.isSameDayEligible(
      input.pickupWindowStart,
      input.dropoffWindowEnd,
      routeMetrics?.durationMinutes ?? 0,
      bufferMinutes,
      policy?.maxSameDayMiles ?? null,
      routeMetrics?.distanceMiles ?? null
    );

    // Hard-block same-day delivery creation after cutoff.
    // Only applies when the pickup is actually TODAY in business timezone.
    // A delivery for tomorrow or later should never be blocked by today's cutoff.
    const isSameDay = this.isSameCalendarDay(
      input.pickupWindowStart,
      input.dropoffWindowEnd
    );
    const isPickupToday = input.pickupWindowStart
      ? businessIsSameDay(input.pickupWindowStart, new Date())
      : false;
    if (isSameDay && isPickupToday) {
      const cutoffResult = this.enforceSameDayCutoff(policy);
      if (cutoffResult === 'blocked') {
        throw new BadRequestException(
          'Cutoff time has passed. No more same-day deliveries can be created today. Please choose a next-day delivery window.',
        );
      }
    }

    const requiresOpsConfirmation =
      policy?.requiresOpsConfirmation === true ||
      (input.afterHours === true && policy?.afterHoursEnabled !== true) ||
      (sameDayEligible === false &&
        this.isSameCalendarDay(
          input.pickupWindowStart,
          input.dropoffWindowEnd
        ));

    // Release any CANCELLED *or* DRAFT delivery that still holds this quoteId
    // before creating the new delivery, otherwise the create below will throw
    // a 409 "Another record with the requested (quoteId) already exists" and
    // the dealer's retry button won't work.
    //
    // CRITICAL: this is the dealer-facing create-from-quote path. The most
    // common cause of a stuck quoteId here is a previously-saved DRAFT that
    // still holds the quoteId (the dealer saved a draft after calculating a
    // quote, then came back to promote it).
    //
    // releasePriorQuoteId handles both CANCELLED and DRAFT, scoped to the
    // same customer. The old row's quoteId is nulled; the row itself stays
    // (CANCELLED for audit, DRAFT for the dealer to delete via onSuccess).
    await this.releasePriorQuoteId(input.quoteId, input.customerId);

    const delivery = await this.prisma.deliveryRequest.create({
      data: {
        customerId: input.customerId,
        quoteId: input.quoteId,
        createdByUserId: input.createdByUserId ?? null,
        createdByRole: input.createdByRole ?? null,
        customerChose: input.customerChose ?? null,

        pickupAddress: quote.pickupAddress,
        pickupLat: quote.pickupLat ?? null,
        pickupLng: quote.pickupLng ?? null,
        pickupPlaceId: quote.pickupPlaceId ?? null,
        pickupState: quote.pickupState ?? null,

        dropoffAddress: quote.dropoffAddress,
        dropoffLat: quote.dropoffLat ?? null,
        dropoffLng: quote.dropoffLng ?? null,
        dropoffPlaceId: quote.dropoffPlaceId ?? null,
        dropoffState: quote.dropoffState ?? null,

        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        dropoffWindowStart: input.dropoffWindowStart,
        dropoffWindowEnd: input.dropoffWindowEnd,

        etaMinutes: routeMetrics?.durationMinutes ?? null,
        bufferMinutes,
        sameDayEligible,
        requiresOpsConfirmation,
        afterHours: input.afterHours === true,

        serviceType: input.serviceType,
        status: EnumDeliveryRequestStatus.LISTED,

        licensePlate: input.licensePlate.trim(),
        vehicleColor: input.vehicleColor.trim(),
        vehicleMake: input.vehicleMake?.trim() || null,
        vehicleModel: input.vehicleModel?.trim() || null,
        vinVerificationCode: input.vinVerificationCode.trim(),

        // Vehicle standards attestation — REQUIRED for new deliveries (the
        // frontend blocks submission if the box is unchecked, but we don't
        // hard-fail here to avoid breaking legacy programmatic callers).
        // Stamp both the flag and the timestamp so insurers get an audit trail.
        vehicleStandardsConfirmed: input.vehicleStandardsConfirmed === true,
        vehicleStandardsConfirmedAt:
          input.vehicleStandardsConfirmed === true ? new Date() : null,

        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        recipientPhone: input.recipientPhone?.trim() || null,

        isUrgent: input.isUrgent === true,
        pickupPin: this.generateIndividualPin(),
      },
      select: {
        id: true,
        status: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        etaMinutes: true,
        sameDayEligible: true,
        requiresOpsConfirmation: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        createdAt: true,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        actorUserId: input.createdByUserId ?? null,
        actorRole: input.createdByRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: null,
        toStatus: EnumDeliveryStatusHistoryToStatus.LISTED,
        note: "Delivery created and listed on marketplace",
      },
    });

    await this.prisma.deliveryCompliance.create({
      data: {
        deliveryId: delivery.id,
        vinVerificationCode: input.vinVerificationCode.trim(),
      },
    });

    await this.prisma.trackingSession.create({
      data: {
        deliveryId: delivery.id,
      },
    });

    const paymentType =
      customer.customerType === EnumCustomerCustomerType.BUSINESS &&
      customer.postpaidEnabled === true
        ? EnumPaymentPaymentType.POSTPAID
        : EnumPaymentPaymentType.PREPAID;

    // Create the Payment row first; the shared Stripe helper will update it
    // to STRIPE/AUTHORIZED (prepaid) or leave it MANUAL (postpaid → invoice).
    const payment = await this.prisma.payment.create({
      data: {
        deliveryId: delivery.id,
        amount: quote.estimatedPrice,
        paymentType,
        // Default to MANUAL here; the helper will flip to STRIPE if it
        // successfully creates a PaymentIntent. For POSTPAID, MANUAL is
        // correct — the invoice lifecycle handles collection.
        provider: EnumPaymentProvider.MANUAL,
        status: EnumPaymentStatus.AUTHORIZED,
        authorizedAt: businessNow().toJSDate(),
      },
    });

    // For PREPAID business customers, actually charge the saved card via Stripe.
    // Throws a user-facing BadRequestException on failure — no silent fallback.
    if (paymentType === EnumPaymentPaymentType.PREPAID) {
      let chargeResult: { paymentIntentId: string; clientSecret: string; status: string };
      try {
        chargeResult = await this.attemptStripePrepaidCharge({
          paymentId: payment.id,
          amount: quote.estimatedPrice,
          deliveryId: delivery.id,
          paymentType,
          customer: {
            id: customer.id,
            stripeCustomerId: customer.stripeCustomerId,
            stripeDefaultPaymentMethodId: customer.stripeDefaultPaymentMethodId,
          },
          customerEmail: customer.contactEmail || customer.user?.email || null,
        });
      } catch (err: any) {
        // Mark the delivery as CANCELLED so it doesn't pollute the driver feed,
        // then re-throw so the API layer surfaces the error to the dealer.
        await this.cancelDeliveryOnPaymentFailure(
          delivery.id,
          err?.message || 'Unknown error',
          input.createdByUserId ?? null,
        );
        throw err;
      }

      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: EnumPaymentEventType.AUTHORIZE,
          status: EnumPaymentEventStatus.AUTHORIZED,
          amount: quote.estimatedPrice,
          message: "Prepaid payment authorized via Stripe at delivery creation",
          raw: {
            source: "business-create-from-quote",
            deliveryId: delivery.id,
            customerId: customer.id,
            paymentType,
            paymentIntentId: chargeResult.paymentIntentId,
            piStatus: chargeResult.status,
          },
        },
      });
    } else {
      // POSTPAID — no charge now. Leave as MANUAL/AUTHORIZED; the invoice
      // lifecycle flips to INVOICED then PAID when the dealer settles.
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: EnumPaymentEventType.AUTHORIZE,
          status: EnumPaymentEventStatus.AUTHORIZED,
          amount: quote.estimatedPrice,
          message: "Postpaid delivery created — payment will be invoiced",
          raw: {
            source: "business-create-from-quote",
            deliveryId: delivery.id,
            customerId: customer.id,
            paymentType,
          },
        },
      });
    }

    await this.notificationEventEngine.notifyDeliveryReleased({
      deliveryId: delivery.id,
      actorUserId: input.createdByUserId ?? null,
    });

    // Emit socket events so driver feed updates in real-time.
    // Gateway methods have null checks on this.server, so this is safe even if
    // the circular dependency leaves trackingGateway partially injected.
    if (this.trackingGateway) {
      this.trackingGateway.emitNewDelivery({
        deliveryId: delivery.id,
        dealerId: customer.id,
        delivery: {
          id: delivery.id,
          status: delivery.status,
          pickupAddress: delivery.pickupAddress,
          dropoffAddress: delivery.dropoffAddress,
          pickupWindowStart: delivery.pickupWindowStart?.toISOString() ?? null,
          pickupWindowEnd: delivery.pickupWindowEnd?.toISOString() ?? null,
          createdAt: delivery.createdAt?.toISOString() ?? new Date().toISOString(),
        },
      });
      this.trackingGateway.emitFeedUpdate({
        deliveryId: delivery.id,
        status: delivery.status,
      });
    }

    return delivery;
  }

  private assertScheduleWindows(input: CreateDeliveryFromQuoteInput) {
    if (input.pickupWindowStart >= input.pickupWindowEnd) {
      throw new BadRequestException("Pickup window start must be before end");
    }

    if (input.dropoffWindowStart >= input.dropoffWindowEnd) {
      throw new BadRequestException("Drop-off window start must be before end");
    }

    if (input.dropoffWindowEnd < input.pickupWindowStart) {
      throw new BadRequestException(
        "Drop-off window cannot end before pickup starts"
      );
    }
  }

  private isSameDayEligible(
    pickupStart: Date,
    dropoffEnd: Date,
    etaMinutes: number,
    bufferMinutes: number,
    maxSameDayMiles: number | null,
    miles: number | null
  ): boolean {
    if (!this.isSameCalendarDay(pickupStart, dropoffEnd)) {
      return false;
    }

    if (maxSameDayMiles != null && miles != null && miles > maxSameDayMiles) {
      return false;
    }

    const availableMinutes = Math.floor(
      (dropoffEnd.getTime() - pickupStart.getTime()) / (1000 * 60)
    );

    return availableMinutes >= etaMinutes + bufferMinutes;
  }

  /**
   * Check if the current time has passed the same-day cutoff.
   * Returns 'blocked' if cutoff has passed and ops confirmation is NOT required.
   * Returns 'allowed' if within cutoff or ops confirmation will handle it.
   */
  private enforceSameDayCutoff(
    policy: any
  ): 'blocked' | 'allowed' {
    const cutoffTime: string | null = policy?.sameDayCutoffTime;
    if (!cutoffTime) return 'allowed';

    const hhmm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(cutoffTime);
    if (!hhmm) return 'allowed';

    if (businessIsPastCutoff(cutoffTime)) {
      if (policy?.requiresOpsConfirmation === true) {
        return 'allowed'; // ops confirmation will flag it
      }
      return 'blocked';
    }

    return 'allowed';
  }

  private isSameCalendarDay(a: Date, b: Date): boolean {
    return businessIsSameDay(a, b);
  }

  private mapDeliveryServiceTypeToQuoteServiceType(
    value: EnumDeliveryRequestServiceType
  ): EnumQuoteServiceType {
    if (value === EnumDeliveryRequestServiceType.HOME_DELIVERY) {
      return EnumQuoteServiceType.HOME_DELIVERY;
    }

    if (value === EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS) {
      return EnumQuoteServiceType.BETWEEN_LOCATIONS;
    }

    return EnumQuoteServiceType.SERVICE_PICKUP_RETURN;
  }

  private mapDeliveryServiceTypeToSchedulingServiceType(
    value: EnumDeliveryRequestServiceType
  ): EnumSchedulingPolicyServiceType {
    if (value === EnumDeliveryRequestServiceType.HOME_DELIVERY) {
      return EnumSchedulingPolicyServiceType.HOME_DELIVERY;
    }

    if (value === EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS) {
      return EnumSchedulingPolicyServiceType.BETWEEN_LOCATIONS;
    }

    return EnumSchedulingPolicyServiceType.SERVICE_PICKUP_RETURN;
  }

  private resolveIndividualSchedule(input: {
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    dropoffWindowStart: Date | null;
    dropoffWindowEnd: Date | null;
    etaMinutes: number;
    bufferMinutes: number;
  }) {
    const hasPickup = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoff = !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    if (hasPickup && hasDropoff) {
      return {
        pickupWindowStart: input.pickupWindowStart!,
        pickupWindowEnd: input.pickupWindowEnd!,
        dropoffWindowStart: input.dropoffWindowStart!,
        dropoffWindowEnd: input.dropoffWindowEnd!,
      };
    }

    if (!hasPickup && !hasDropoff) {
      throw new BadRequestException(
        "Provide either pickup window or dropoff window"
      );
    }

    const travelWithBufferMinutes = input.etaMinutes + input.bufferMinutes;

    if (hasPickup) {
      const pickupStart = input.pickupWindowStart!;
      const pickupEnd = input.pickupWindowEnd!;

      return {
        pickupWindowStart: pickupStart,
        pickupWindowEnd: pickupEnd,
        dropoffWindowStart: new Date(
          pickupStart.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
        dropoffWindowEnd: new Date(
          pickupEnd.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
      };
    }

    const dropoffStart = input.dropoffWindowStart!;
    const dropoffEnd = input.dropoffWindowEnd!;

    return {
      pickupWindowStart: new Date(
        dropoffStart.getTime() - travelWithBufferMinutes * 60 * 1000
      ),
      pickupWindowEnd: new Date(
        dropoffEnd.getTime() - travelWithBufferMinutes * 60 * 1000
      ),
      dropoffWindowStart: dropoffStart,
      dropoffWindowEnd: dropoffEnd,
    };
  }

  private async upsertSavedVehicleForCustomer(
    customerId: string,
    input: {
      licensePlate: string;
      make: string | null;
      model: string | null;
      color: string;
    }
  ) {
    const existing = await this.prisma.savedVehicle.findFirst({
      where: {
        customerId,
        licensePlate: input.licensePlate,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.savedVehicle.update({
        where: { id: existing.id },
        data: {
          make: input.make,
          model: input.model,
          color: input.color,
        },
      });
    }

    return this.prisma.savedVehicle.create({
      data: {
        customerId,
        licensePlate: input.licensePlate,
        make: input.make,
        model: input.model,
        color: input.color,
      },
    });
  }

  async schedulePreview(
    input: SchedulePreviewInput
  ): Promise<SchedulePreviewResult> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        serviceType: true,
      },
    });
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    const expectedQuoteServiceType =
      this.mapDeliveryServiceTypeToQuoteServiceType(input.serviceType);

    if (quote.serviceType !== expectedQuoteServiceType) {
      throw new BadRequestException(
        "Selected service type does not match the quote"
      );
    }

    this.validatePreviewWindowPair(
      input.pickupWindowStart ?? null,
      input.pickupWindowEnd ?? null,
      "pickup window"
    );
    this.validatePreviewWindowPair(
      input.dropoffWindowStart ?? null,
      input.dropoffWindowEnd ?? null,
      "dropoff window"
    );

    let policyCustomerType: EnumSchedulingPolicyCustomerType =
      EnumSchedulingPolicyCustomerType.BUSINESS;

    if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: {
          id: true,
          customerType: true,
        },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      policyCustomerType =
        customer.customerType === EnumCustomerCustomerType.BUSINESS
          ? EnumSchedulingPolicyCustomerType.BUSINESS
          : EnumSchedulingPolicyCustomerType.PRIVATE;
    }

    const routeMetrics =
      quote.pickupLat != null &&
      quote.pickupLng != null &&
      quote.dropoffLat != null &&
      quote.dropoffLng != null
        ? await this.mapsService.computeRouteMetrics({
            originLat: quote.pickupLat,
            originLng: quote.pickupLng,
            destinationLat: quote.dropoffLat,
            destinationLng: quote.dropoffLng,
          })
        : null;

    const policy =
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: this.mapDeliveryServiceTypeToSchedulingServiceType(
            input.serviceType
          ),
        },
        orderBy: { createdAt: "desc" },
      })) ??
      (await this.prisma.schedulingPolicy.findFirst({
        where: {
          active: true,
          customerType: policyCustomerType,
          serviceType: null,
        },
        orderBy: { createdAt: "desc" },
      }));

    const policyAny = policy as any;

    const bufferMinutes = policy?.bufferMinutes ?? 30;
    const etaMinutes = routeMetrics?.durationMinutes ?? null;
    const distanceMiles = routeMetrics?.distanceMiles ?? null;

    const resolvedCustomerChose = this.resolvePreviewCustomerChose({
      customerChose: input.customerChose ?? null,
      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,
    });

    const schedule = this.resolveSchedulePreview({
      customerChose: resolvedCustomerChose,
      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,
      etaMinutes: etaMinutes ?? 0,
      bufferMinutes,
    });

    const sameDayRequested = this.isSameCalendarDay(
      schedule.pickupWindowStart,
      schedule.dropoffWindowEnd
    );

    const sameDayEligible = this.isSameDayEligible(
      schedule.pickupWindowStart,
      schedule.dropoffWindowEnd,
      etaMinutes ?? 0,
      bufferMinutes,
      policy?.maxSameDayMiles ?? null,
      distanceMiles
    );

    const afterHours = this.isScheduleAfterHours(
      {
        pickupWindowStart: schedule.pickupWindowStart,
        pickupWindowEnd: schedule.pickupWindowEnd,
        dropoffWindowStart: schedule.dropoffWindowStart,
        dropoffWindowEnd: schedule.dropoffWindowEnd,
      },
      policyAny
    );

    let feasible = true;
    let requiresOpsConfirmation = false;
    let message: string | null = null;

    const availableMinutes = Math.floor(
      (schedule.dropoffWindowEnd.getTime() -
        schedule.pickupWindowStart.getTime()) /
        (1000 * 60)
    );
    const requiredMinutes = (etaMinutes ?? 0) + bufferMinutes;

    if (schedule.pickupWindowStart >= schedule.pickupWindowEnd) {
      feasible = false;
      message = "Pickup window start must be before pickup window end.";
    } else if (schedule.dropoffWindowStart >= schedule.dropoffWindowEnd) {
      feasible = false;
      message = "Drop-off window start must be before drop-off window end.";
    } else if (schedule.dropoffWindowEnd <= schedule.pickupWindowStart) {
      feasible = false;
      message = "Drop-off window must occur after pickup window.";
    } else if (availableMinutes < requiredMinutes) {
      feasible = false;
      message =
        "Selected schedule does not allow enough time for route ETA plus buffer.";
    } else if (sameDayRequested && !sameDayEligible) {
      const shouldRouteToOps =
        policy?.requiresOpsConfirmation === true ||
        policyAny?.manualConfirmationForSameDayFailure === true;

      if (shouldRouteToOps) {
        feasible = true;
        requiresOpsConfirmation = true;
        message =
          "Same-day scheduling is outside current policy and requires Operations confirmation.";
      } else {
        feasible = false;
        message =
          "Same-day scheduling is not eligible for this route or time window. Please choose the nearest feasible next option.";
      }
    }

    if (afterHours) {
      if (policy?.afterHoursEnabled === true) {
        message =
          message ??
          "Schedule is outside normal operating hours but after-hours delivery is enabled.";
      } else {
        requiresOpsConfirmation = true;
        message =
          message ??
          "This schedule is outside normal operating hours and requires Operations confirmation.";
      }
    }

    const dealerSameDayCutoffHour = this.resolveNumericPolicyValue(
      policyAny?.sameDayCutoffHour,
      15
    );
    const latestWindowEndHour = this.resolveNumericPolicyValue(
      policyAny?.latestDeliveryWindowEndHour,
      19
    );
    const earliestWindowStartHour = this.resolveNumericPolicyValue(
      policyAny?.earliestPickupWindowStartHour,
      7
    );

    if (sameDayRequested) {
      if (this.isSameCalendarDay(businessNow().toJSDate(), schedule.pickupWindowStart)) {
        const hhmm = `${String(dealerSameDayCutoffHour).padStart(2, '0')}:00`;
        if (businessIsPastCutoff(hhmm)) {
          if (policy?.requiresOpsConfirmation === true) {
            requiresOpsConfirmation = true;
            message =
              message ??
              "Same-day cutoff has passed and this request requires Operations confirmation.";
          } else {
            feasible = false;
            message =
              message ??
              "Same-day cutoff has passed for dealer scheduling. Please choose the next feasible slot.";
          }
        }
      }
    }

    if (
      this.hourOf(schedule.pickupWindowStart) < earliestWindowStartHour ||
      this.hourOf(schedule.dropoffWindowEnd) > latestWindowEndHour
    ) {
      if (policy?.afterHoursEnabled === true) {
        message =
          message ??
          "Selected schedule falls outside default MVP time windows but remains allowed by policy.";
      } else {
        requiresOpsConfirmation = true;
        message =
          message ??
          "Selected schedule falls outside default MVP time windows and requires Operations confirmation.";
      }
    }

    return {
      pickupWindowStart: schedule.pickupWindowStart,
      pickupWindowEnd: schedule.pickupWindowEnd,
      dropoffWindowStart: schedule.dropoffWindowStart,
      dropoffWindowEnd: schedule.dropoffWindowEnd,
      etaMinutes,
      bufferMinutes,
      sameDayEligible,
      requiresOpsConfirmation,
      afterHours,
      feasible,
      message,
    };
  }

  private resolvePreviewCustomerChose(input: {
    customerChose: EnumDeliveryRequestCustomerChose | null;
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    dropoffWindowStart: Date | null;
    dropoffWindowEnd: Date | null;
  }): EnumDeliveryRequestCustomerChose | null {
    const hasPickup = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoff = !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    if (input.customerChose) {
      if (
        input.customerChose === EnumDeliveryRequestCustomerChose.PICKUP_WINDOW &&
        !hasPickup
      ) {
        throw new BadRequestException(
          "customerChose is PICKUP_WINDOW but pickup window is missing"
        );
      }

      if (
        input.customerChose === EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW &&
        !hasDropoff
      ) {
        throw new BadRequestException(
          "customerChose is DROPOFF_WINDOW but dropoff window is missing"
        );
      }

      return input.customerChose;
    }

    if (hasPickup && !hasDropoff) {
      return EnumDeliveryRequestCustomerChose.PICKUP_WINDOW;
    }

    if (!hasPickup && hasDropoff) {
      return EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW;
    }

    if (hasPickup && hasDropoff) {
      return null;
    }

    throw new BadRequestException(
      "Provide either pickup window or dropoff window for schedule preview"
    );
  }

  private resolveSchedulePreview(input: {
    customerChose: EnumDeliveryRequestCustomerChose | null;
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    dropoffWindowStart: Date | null;
    dropoffWindowEnd: Date | null;
    etaMinutes: number;
    bufferMinutes: number;
  }) {
    const hasPickup = !!input.pickupWindowStart && !!input.pickupWindowEnd;
    const hasDropoff = !!input.dropoffWindowStart && !!input.dropoffWindowEnd;

    if (hasPickup && hasDropoff && !input.customerChose) {
      return {
        pickupWindowStart: input.pickupWindowStart!,
        pickupWindowEnd: input.pickupWindowEnd!,
        dropoffWindowStart: input.dropoffWindowStart!,
        dropoffWindowEnd: input.dropoffWindowEnd!,
      };
    }

    const travelWithBufferMinutes = input.etaMinutes + input.bufferMinutes;

    if (
      input.customerChose === EnumDeliveryRequestCustomerChose.PICKUP_WINDOW ||
      (hasPickup && !hasDropoff)
    ) {
      const pickupStart = input.pickupWindowStart!;
      const pickupEnd = input.pickupWindowEnd!;

      return {
        pickupWindowStart: pickupStart,
        pickupWindowEnd: pickupEnd,
        dropoffWindowStart: new Date(
          pickupStart.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
        dropoffWindowEnd: new Date(
          pickupEnd.getTime() + travelWithBufferMinutes * 60 * 1000
        ),
      };
    }

    if (
      input.customerChose === EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW ||
      (!hasPickup && hasDropoff)
    ) {
      const dropoffStart = input.dropoffWindowStart!;
      const dropoffEnd = input.dropoffWindowEnd!;

      return {
        pickupWindowStart: new Date(
          dropoffStart.getTime() - travelWithBufferMinutes * 60 * 1000
        ),
        pickupWindowEnd: new Date(
          dropoffEnd.getTime() - travelWithBufferMinutes * 60 * 1000
        ),
        dropoffWindowStart: dropoffStart,
        dropoffWindowEnd: dropoffEnd,
      };
    }

    throw new BadRequestException("Unable to resolve schedule preview");
  }

  private validatePreviewWindowPair(
    start: Date | null,
    end: Date | null,
    label: string
  ): void {
    if ((start && !end) || (!start && end)) {
      throw new BadRequestException(
        `${label} start and end must both be provided together`
      );
    }

    if (!start && !end) {
      return;
    }

    const startDate = new Date(start as Date);
    const endDate = new Date(end as Date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(`${label} is invalid`);
    }

    if (endDate <= startDate) {
      throw new BadRequestException(`${label} end must be after start`);
    }
  }

  private isScheduleAfterHours(
    input: {
      pickupWindowStart: Date;
      pickupWindowEnd: Date;
      dropoffWindowStart: Date;
      dropoffWindowEnd: Date;
    },
    policy: any
  ): boolean {
    const earliestHour = this.resolveNumericPolicyValue(
      policy?.earliestPickupWindowStartHour,
      7
    );
    const latestHour = this.resolveNumericPolicyValue(
      policy?.latestDeliveryWindowEndHour,
      19
    );

    const values = [
      input.pickupWindowStart,
      input.pickupWindowEnd,
      input.dropoffWindowStart,
      input.dropoffWindowEnd,
    ];

    return values.some((value) => {
      const hour = this.hourOf(value);
      return hour < earliestHour || hour >= latestHour;
    });
  }

  private hourOf(value: Date): number {
    return businessHourOf(value);
  }

  private resolveNumericPolicyValue(
    value: unknown,
    fallback: number
  ): number {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
        ? Number(value)
        : NaN;

    return Number.isFinite(parsed) ? parsed : fallback;
  }
}