/**
 * Unit tests for PaymentPayoutEngine.handleCompletionTx — lock-in branch.
 *
 * Verifies the audit fixes for:
 *  - Issue 1 (Critical): remainderCaptured must NOT be set true when the
 *    Stripe PaymentIntent is in a non-succeeded state (e.g. customer had
 *    no saved card → PI returns requires_payment_method).
 *  - Issue 5 (High): providerChargeId must be populated from the refreshed
 *    PI's latest_charge, not left null for the webhook to fill in.
 */
import { PaymentPayoutEngine } from "./paymentPayout.engine";
import { StripeService } from "../../providers/stripe/stripe.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EnumDriverPayoutType,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
} from "@prisma/client";

// ── helpers ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockTx = any;

const makeMockTx = (): MockTx => {
  const tx = {
    deliveryRequest: { findUnique: jest.fn() },
    payment: { update: jest.fn() },
    paymentEvent: { create: jest.fn() },
    driverPayout: { upsert: jest.fn() },
  };
  return tx;
};

const makeStripeService = (opts: {
  piStatus: string;
  chargeId?: string | { id: string } | null;
}) => {
  const piId = "pi_test_REMAINDER_001";
  const refreshedPi: any = {
    id: piId,
    status: opts.piStatus,
    latest_charge: opts.chargeId ?? null,
  };
  return {
    createPaymentIntent: jest.fn().mockResolvedValue({
      paymentIntentId: piId,
      clientSecret: "pi_test_secret_xxx",
      status: opts.piStatus,
    }),
    getPaymentIntent: jest.fn().mockResolvedValue(refreshedPi),
    capturePaymentIntent: jest.fn(),
    createTransfer: jest.fn(),
    createInstantPayout: jest.fn(),
    createRefund: jest.fn(),
  } as unknown as StripeService;
};

const baseDelivery = {
  id: "del_test_001",
  status: "COMPLETED",
  lockedInAt: new Date(),
  lockInBaseFee: 25, // $25 lock-in fee
  lockInDriverSharePct: 60,
  lockInPaymentIntentId: "pi_test_LOCKIN_001",
  payment: {
    id: "pay_test_001",
    amount: 250, // $250 quoted total
    paymentType: EnumPaymentPaymentType.PREPAID,
    provider: EnumPaymentProvider.STRIPE,
    status: EnumPaymentStatus.AUTHORIZED,
    providerPaymentIntentId: "pi_test_LOCKIN_001",
    providerChargeId: null,
    lockInAmount: 25,
    lockInChargeId: "ch_lockin_001",
    invoiceId: null,
  },
  payout: null,
  tip: null,
  quote: {
    estimatedPrice: 250,
    pricingSnapshot: null,
    feesBreakdown: null,
  },
  // NOTE: no stripeDefaultPaymentMethodId — this is the bug-trigger condition
  customer: {
    id: "cus_test_001",
    stripeCustomerId: "cus_stripe_001",
    stripeDefaultPaymentMethodId: null,
    postpaidEnabled: false,
  },
  assignments: [
    {
      id: "asg_test_001",
      driverId: "drv_test_001",
      driver: {
        id: "drv_test_001",
        stripeConnectAccountId: "acct_complete_001",
        stripeConnectOnboardingComplete: true,
      },
    },
  ],
};

// ── tests ──────────────────────────────────────────────────────────────────
describe("PaymentPayoutEngine.handleCompletionTx — lock-in branch (Issue 1 + 5)", () => {
  let engine: PaymentPayoutEngine;
  let tx: MockTx;
  let stripeService: StripeService;
  let prismaService: { $transaction: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaService = { $transaction: jest.fn() };
  });

  it("Scenario A: PI status='requires_payment_method' → must NOT mark captured, must NOT upgrade payout, must NOT transfer", async () => {
    tx = makeMockTx();
    tx.deliveryRequest.findUnique.mockResolvedValue(baseDelivery);
    stripeService = makeStripeService({
      piStatus: "requires_payment_method",
      chargeId: null,
    });

    engine = new PaymentPayoutEngine(
      prismaService as any,
      stripeService,
      undefined, // NotificationEventEngine — not used in this path
    );

    await engine.handleCompletionTx(tx as any, {
      deliveryId: "del_test_001",
    });

    // ─ Issue 1 assertions ────────────────────────────────────────────────
    // createPaymentIntent MUST be called (we always create the remainder PI).
    expect(stripeService.createPaymentIntent).toHaveBeenCalledTimes(1);
    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 225, // 250 - 25
        deliveryId: "del_test_001",
        confirm: false, // ← the bug-trigger condition: no saved card
        captureMethod: "automatic",
      }),
    );

    // getPaymentIntent MUST be called to verify the PI's actual status.
    expect(stripeService.getPaymentIntent).toHaveBeenCalledTimes(1);
    expect(stripeService.getPaymentIntent).toHaveBeenCalledWith(
      "pi_test_REMAINDER_001",
    );

    // payment.update MUST be called with status=AUTHORIZED (NOT CAPTURED)
    // and a failureMessage explaining why.
    expect(tx.payment.update).toHaveBeenCalledTimes(1);
    const updateCall = tx.payment.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe("pay_test_001");
    expect(updateCall.data.status).toBe(EnumPaymentStatus.AUTHORIZED);
    expect(updateCall.data.failureMessage).toMatch(/requires_payment_method/);
    expect(updateCall.data.providerPaymentIntentId).toBe(
      "pi_test_REMAINDER_001",
    );
    // providerChargeId MUST NOT be set when the PI didn't succeed
    expect(updateCall.data).not.toHaveProperty("providerChargeId");
    // capturedAt MUST NOT be set
    expect(updateCall.data).not.toHaveProperty("capturedAt");

    // A FAIL PaymentEvent MUST be created with the explanation.
    expect(tx.paymentEvent.create).toHaveBeenCalledTimes(1);
    const eventCall = tx.paymentEvent.create.mock.calls[0][0];
    expect(eventCall.data.type).toBe(EnumPaymentEventType.FAIL);
    expect(eventCall.data.status).toBe(EnumPaymentEventStatus.FAILED);
    expect(eventCall.data.amount).toBe(225);
    expect(eventCall.data.message).toMatch(/requires_payment_method/);

    // ─ Issue 6 (related) assertions ──────────────────────────────────────
    // driverPayout.upsert MUST NOT be called — we must not upgrade the
    // existing lock-in payout to TRIP_COMPLETION.
    expect(tx.driverPayout.upsert).not.toHaveBeenCalled();

    // createTransfer MUST NOT be called — we must not auto-transfer money
    // we never received from the customer.
    expect(stripeService.createTransfer).not.toHaveBeenCalled();
  });

  it("Scenario B: PI status='succeeded' + latest_charge='ch_xxx' → MUST mark captured, MUST set providerChargeId, MUST upgrade payout", async () => {
    tx = makeMockTx();
    tx.deliveryRequest.findUnique.mockResolvedValue(baseDelivery);
    stripeService = makeStripeService({
      piStatus: "succeeded",
      chargeId: "ch_remainder_001", // string form
    });

    engine = new PaymentPayoutEngine(
      prismaService as any,
      stripeService,
      undefined,
    );

    await engine.handleCompletionTx(tx as any, {
      deliveryId: "del_test_001",
    });

    // ─ Issue 5 assertions ────────────────────────────────────────────────
    expect(stripeService.getPaymentIntent).toHaveBeenCalledTimes(1);

    expect(tx.payment.update).toHaveBeenCalledTimes(1);
    const updateCall = tx.payment.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe("pay_test_001");
    expect(updateCall.data.status).toBe(EnumPaymentStatus.CAPTURED);
    expect(updateCall.data.providerChargeId).toBe("ch_remainder_001");
    expect(updateCall.data.capturedAt).toBeInstanceOf(Date);
    expect(updateCall.data.amount).toBe(250); // totalQuoted
    expect(updateCall.data.failureMessage).toBeNull();

    // A CAPTURE PaymentEvent MUST be created.
    expect(tx.paymentEvent.create).toHaveBeenCalledTimes(1);
    const eventCall = tx.paymentEvent.create.mock.calls[0][0];
    expect(eventCall.data.type).toBe(EnumPaymentEventType.CAPTURE);
    expect(eventCall.data.status).toBe(EnumPaymentEventStatus.CAPTURED);
    expect(eventCall.data.amount).toBe(225);
    expect(eventCall.data.providerRef).toBe("pi_test_REMAINDER_001");
    expect(eventCall.data.raw.chargeId).toBe("ch_remainder_001");

    // driverPayout.upsert MUST be called with TRIP_COMPLETION type.
    expect(tx.driverPayout.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = tx.driverPayout.upsert.mock.calls[0][0];
    expect(upsertCall.create.type).toBe(
      EnumDriverPayoutType.TRIP_COMPLETION,
    );
    expect(upsertCall.update.type).toBe(
      EnumDriverPayoutType.TRIP_COMPLETION,
    );

    // ─ Note on Issue 6 (NOT tested here) ─────────────────────────────────
    // `initiateDriverTransfer` is invoked fire-and-forgotten from this path
    // when payoutStatus === ELIGIBLE and the driver has a Connect account.
    // It uses `this.prisma.driverPayout.findUnique` (NOT the tx mock) so it
    // would need a fuller Prisma mock to assert end-to-end. The race-condition
    // fix for Issue 6 is a separate change — see audit report.
  });

  it("Scenario C: PI status='succeeded' + latest_charge={id:'ch_xxx'} (object form) → MUST extract chargeId from object", async () => {
    // Stripe SDK can return latest_charge as either a string or an
    // expanded Charge object. The fix must handle both forms.
    tx = makeMockTx();
    tx.deliveryRequest.findUnique.mockResolvedValue(baseDelivery);
    stripeService = makeStripeService({
      piStatus: "succeeded",
      chargeId: { id: "ch_remainder_obj_001" }, // object form
    });

    engine = new PaymentPayoutEngine(
      prismaService as any,
      stripeService,
      undefined,
    );

    await engine.handleCompletionTx(tx as any, {
      deliveryId: "del_test_001",
    });

    const updateCall = tx.payment.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe(EnumPaymentStatus.CAPTURED);
    expect(updateCall.data.providerChargeId).toBe("ch_remainder_obj_001");
  });

  it("Scenario D: PI status='requires_action' (SCA challenge) → MUST be treated as not-captured (same as Scenario A)", async () => {
    // Even if the customer HAD a saved card, an SCA challenge can leave the
    // PI in `requires_action`. The fix must catch this too — not just the
    // no-saved-card case.
    tx = makeMockTx();
    tx.deliveryRequest.findUnique.mockResolvedValue({
      ...baseDelivery,
      customer: {
        ...baseDelivery.customer!,
        stripeDefaultPaymentMethodId: "pm_saved_card_001",
      },
    });
    stripeService = makeStripeService({
      piStatus: "requires_action",
      chargeId: null,
    });

    engine = new PaymentPayoutEngine(
      prismaService as any,
      stripeService,
      undefined,
    );

    await engine.handleCompletionTx(tx as any, {
      deliveryId: "del_test_001",
    });

    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: true }), // saved card was present
    );

    const updateCall = tx.payment.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe(EnumPaymentStatus.AUTHORIZED);
    expect(updateCall.data.failureMessage).toMatch(/requires_action/);

    expect(tx.driverPayout.upsert).not.toHaveBeenCalled();
    expect(stripeService.createTransfer).not.toHaveBeenCalled();
  });
});
