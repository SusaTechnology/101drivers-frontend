/**
 * Unit tests for DisputeAdminEngine — resolve, reject, close.
 *
 * Verifies:
 *  - resolveDispute(approveRefund=false) marks RESOLVED without calling Stripe.
 *  - resolveDispute(approveRefund=true) calls Stripe.createRefund, persists
 *    stripeRefundId, updates Payment.status, reverts delivery to COMPLETED.
 *  - resolveDispute throws when no Payment exists for the delivery.
 *  - resolveDispute throws when Payment has no providerChargeId.
 *  - resolveDispute throws when refundAmount > payment.amount.
 *  - resolveDispute on a CLOSED dispute throws.
 *  - rejectDispute sets status=REJECTED + rejectionReason, reverts delivery.
 *  - rejectDispute without rejectionReason throws.
 *  - rejectDispute on a CLOSED dispute throws.
 *  - closeDispute reverts delivery from DISPUTED to COMPLETED.
 *  - State transition validator blocks invalid transitions
 *    (e.g. CLOSED → anything).
 *
 * Mocks: PrismaService, NotificationEventEngine, StripeService.
 * The engine wraps multi-table writes in prisma.$transaction(cb) — the
 * mock invokes cb synchronously with the same tx object.
 */
import { DisputeAdminEngine } from "./disputeAdmin.engine";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  EnumDisputeCaseStatus,
  EnumDeliveryRequestStatus,
  EnumPaymentStatus,
} from "@prisma/client";

// ── helpers ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockTx = any;

const DISPUTE_ID = "dsp_001";
const DELIVERY_ID = "del_001";
const PAYMENT_ID = "pay_001";
const ACTOR_ID = "user_admin_001";
const CHARGE_ID = "ch_stripe_abc";
const REFUND_ID = "re_stripe_xyz";

const makeMockTx = (): MockTx => {
  const tx = {
    disputeCase: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    disputeNote: { create: jest.fn() },
    deliveryRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deliveryStatusHistory: { create: jest.fn() },
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: { create: jest.fn() },
  };
  return tx;
};

const makeMockPrisma = (tx: MockTx) => {
  return {
    $transaction: jest.fn(async (cb: (tx: MockTx) => Promise<unknown>) =>
      cb(tx),
    ),
    // disputeCase is queried OUTSIDE the transaction (initial lookup).
    // Each test configures the return value as needed.
    disputeCase: {
      findUnique: jest.fn(),
    },
    // payment is queried OUTSIDE the transaction (in resolveDispute's
    // preflight). Each test configures the return value as needed.
    payment: {
      findUnique: jest.fn(),
    },
  };
};

const makeMockNotificationEngine = () => ({
  notifyDisputeOpened: jest.fn().mockResolvedValue(true),
  notifyDisputeResolved: jest.fn().mockResolvedValue(true),
  notifyDisputeRejected: jest.fn().mockResolvedValue(true),
  notifyDisputeClosed: jest.fn().mockResolvedValue(true),
  notifyDisputeNoteAdded: jest.fn().mockResolvedValue(true),
  notifyLegalHoldUpdated: jest.fn().mockResolvedValue(true),
});

const makeMockStripeService = () => ({
  createRefund: jest.fn().mockResolvedValue({ id: REFUND_ID }),
});

// ── tests ──────────────────────────────────────────────────────────────────
describe("DisputeAdminEngine", () => {
  let engine: DisputeAdminEngine;
  let tx: MockTx;
  let prisma: ReturnType<typeof makeMockPrisma>;
  let notificationEngine: ReturnType<typeof makeMockNotificationEngine>;
  let stripeService: ReturnType<typeof makeMockStripeService>;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = makeMockTx();
    prisma = makeMockPrisma(tx);
    notificationEngine = makeMockNotificationEngine();
    stripeService = makeMockStripeService();
    engine = new DisputeAdminEngine(
      prisma as any,
      notificationEngine as any,
      stripeService as any,
    );
  });

  // ─── resolveDispute ──────────────────────────────────────────────────────
  describe("resolveDispute", () => {
    it("throws NotFoundException when dispute does not exist", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue(null);

      await expect(
        engine.resolveDispute({
          disputeId: "missing",
          approveRefund: false,
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when dispute is already CLOSED", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.CLOSED,
      });

      await expect(
        engine.resolveDispute({
          disputeId: DISPUTE_ID,
          approveRefund: false,
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });

    it("resolves WITHOUT refund when approveRefund=false (no Stripe call)", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });

      await engine.resolveDispute({
        disputeId: DISPUTE_ID,
        approveRefund: false,
        resolutionNote: "Resolved in driver's favor",
        actorUserId: ACTOR_ID,
      });

      // No Stripe call
      expect(stripeService.createRefund).not.toHaveBeenCalled();

      // Status updated to RESOLVED
      expect(tx.disputeCase.update).toHaveBeenCalledWith({
        where: { id: DISPUTE_ID },
        data: expect.objectContaining({
          status: EnumDisputeCaseStatus.RESOLVED,
          resolvedBy: { connect: { id: ACTOR_ID } },
        }),
      });

      // Delivery reverted to COMPLETED
      expect(tx.deliveryRequest.update).toHaveBeenCalledWith({
        where: { id: DELIVERY_ID },
        data: { status: EnumDeliveryRequestStatus.COMPLETED },
      });

      // Notification sent
      expect(notificationEngine.notifyDisputeResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryId: DELIVERY_ID,
          refundIssued: false,
        }),
      );
    });

    it("resolves WITH refund when approveRefund=true (issues Stripe refund)", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });

      // Payment lookup (outside the transaction)
      prisma.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        amount: 150.00,
        providerChargeId: CHARGE_ID,
        status: EnumPaymentStatus.PAID,
      });
      // Payment lookup (inside the transaction)
      tx.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        amount: 150.00,
      });

      await engine.resolveDispute({
        disputeId: DISPUTE_ID,
        approveRefund: true,
        resolutionNote: "Resolved in customer's favor",
        actorUserId: ACTOR_ID,
      });

      // Stripe refund issued with the charge ID
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeId: CHARGE_ID,
          amount: 150.00, // defaults to full payment amount
          metadata: expect.objectContaining({
            disputeId: DISPUTE_ID,
            deliveryId: DELIVERY_ID,
          }),
        }),
      );

      // Dispute updated with stripeRefundId
      expect(tx.disputeCase.update).toHaveBeenCalledWith({
        where: { id: DISPUTE_ID },
        data: expect.objectContaining({
          status: EnumDisputeCaseStatus.RESOLVED,
          stripeRefundId: REFUND_ID,
          resolvedBy: { connect: { id: ACTOR_ID } },
        }),
      });

      // Payment status updated to REFUNDED
      expect(tx.payment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: expect.objectContaining({
          status: EnumPaymentStatus.REFUNDED,
        }),
      });

      // Notification sent with refund info
      expect(notificationEngine.notifyDisputeResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          refundIssued: true,
          stripeRefundId: REFUND_ID,
        }),
      );
    });

    it("supports partial refunds via refundAmount", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });

      prisma.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        amount: 150.00,
        providerChargeId: CHARGE_ID,
        status: EnumPaymentStatus.PAID,
      });
      tx.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        amount: 150.00,
      });

      await engine.resolveDispute({
        disputeId: DISPUTE_ID,
        approveRefund: true,
        refundAmount: 50.00, // partial refund
        actorUserId: ACTOR_ID,
      });

      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeId: CHARGE_ID,
          amount: 50.00,
        }),
      );
    });

    it("throws when approveRefund=true but no Payment exists for the delivery", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        engine.resolveDispute({
          disputeId: DISPUTE_ID,
          approveRefund: true,
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });

    it("throws when approveRefund=true but Payment has no providerChargeId", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      prisma.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        amount: 150.00,
        providerChargeId: null, // never captured
        status: EnumPaymentStatus.AUTHORIZED,
      });

      await expect(
        engine.resolveDispute({
          disputeId: DISPUTE_ID,
          approveRefund: true,
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });

    it("throws when refundAmount exceeds payment amount", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      prisma.payment.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        amount: 100.00,
        providerChargeId: CHARGE_ID,
        status: EnumPaymentStatus.PAID,
      });

      await expect(
        engine.resolveDispute({
          disputeId: DISPUTE_ID,
          approveRefund: true,
          refundAmount: 200.00, // exceeds payment
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });
  });

  // ─── rejectDispute ───────────────────────────────────────────────────────
  describe("rejectDispute", () => {
    it("throws NotFoundException when dispute does not exist", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue(null);

      await expect(
        engine.rejectDispute({
          disputeId: "missing",
          rejectionReason: "No evidence",
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws BadRequestException when rejectionReason is empty", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });

      await expect(
        engine.rejectDispute({
          disputeId: DISPUTE_ID,
          rejectionReason: "   ", // whitespace only
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws BadRequestException when dispute is already CLOSED", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.CLOSED,
      });

      await expect(
        engine.rejectDispute({
          disputeId: DISPUTE_ID,
          rejectionReason: "No evidence",
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects the dispute and reverts delivery to COMPLETED", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });

      await engine.rejectDispute({
        disputeId: DISPUTE_ID,
        rejectionReason: "Customer claim has no merit",
        note: "Internal note",
        actorUserId: ACTOR_ID,
      });

      // Dispute updated to REJECTED with reason
      expect(tx.disputeCase.update).toHaveBeenCalledWith({
        where: { id: DISPUTE_ID },
        data: expect.objectContaining({
          status: EnumDisputeCaseStatus.REJECTED,
          rejectionReason: "Customer claim has no merit",
          resolvedBy: { connect: { id: ACTOR_ID } },
        }),
      });

      // Delivery reverted to COMPLETED
      expect(tx.deliveryRequest.update).toHaveBeenCalledWith({
        where: { id: DELIVERY_ID },
        data: { status: EnumDeliveryRequestStatus.COMPLETED },
      });

      // No Stripe call (rejection never refunds)
      expect(stripeService.createRefund).not.toHaveBeenCalled();

      // Notification sent
      expect(notificationEngine.notifyDisputeRejected).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryId: DELIVERY_ID,
          rejectionReason: "Customer claim has no merit",
        }),
      );
    });
  });

  // ─── closeDispute ────────────────────────────────────────────────────────
  describe("closeDispute", () => {
    it("reverts the delivery from DISPUTED to COMPLETED when closing", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.RESOLVED,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });

      await engine.closeDispute({
        disputeId: DISPUTE_ID,
        closingNote: "All done",
        actorUserId: ACTOR_ID,
      });

      expect(tx.disputeCase.update).toHaveBeenCalledWith({
        where: { id: DISPUTE_ID },
        data: expect.objectContaining({
          status: EnumDisputeCaseStatus.CLOSED,
          closedAt: expect.any(Date),
        }),
      });

      expect(tx.deliveryRequest.update).toHaveBeenCalledWith({
        where: { id: DELIVERY_ID },
        data: { status: EnumDeliveryRequestStatus.COMPLETED },
      });

      expect(notificationEngine.notifyDisputeClosed).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: DELIVERY_ID }),
      );
    });
  });

  // ─── State transition validator ──────────────────────────────────────────
  describe("state transition validator", () => {
    it("allows OPEN → RESOLVED", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });
      // (uses default mock)

      await expect(
        engine.resolveDispute({
          disputeId: DISPUTE_ID,
          approveRefund: false,
          actorUserId: ACTOR_ID,
        }),
      ).resolves.toBeUndefined();
    });

    it("allows OPEN → REJECTED", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.OPEN,
      });
      tx.deliveryRequest.findUnique.mockResolvedValue({
        id: DELIVERY_ID,
        status: EnumDeliveryRequestStatus.DISPUTED,
      });

      await expect(
        engine.rejectDispute({
          disputeId: DISPUTE_ID,
          rejectionReason: "No merit",
          actorUserId: ACTOR_ID,
        }),
      ).resolves.toBeUndefined();
    });

    it("blocks RESOLVED → REJECTED (transition not allowed)", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.RESOLVED,
      });

      await expect(
        engine.rejectDispute({
          disputeId: DISPUTE_ID,
          rejectionReason: "Try again",
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("blocks REJECTED → RESOLVED (transition not allowed)", async () => {
      prisma.disputeCase.findUnique.mockResolvedValue({
        id: DISPUTE_ID,
        deliveryId: DELIVERY_ID,
        status: EnumDisputeCaseStatus.REJECTED,
      });

      await expect(
        engine.resolveDispute({
          disputeId: DISPUTE_ID,
          approveRefund: false,
          actorUserId: ACTOR_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
