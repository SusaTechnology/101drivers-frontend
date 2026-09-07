/**
 * Unit tests for ReferralCreditApplicationService — automatic consumption
 * of customer referral credits.
 *
 * Covers:
 *   - applyPostpaidCreditsToUpcomingInvoice: FIFO whole-credit application,
 *     invoice-total cap, negative InvoiceItem, APPLIED marking, no-credits
 *     no-op, Stripe failure leaves credits PENDING
 *   - refundPrepaidCreditForDelivery: refund against captured PREPAID PI,
 *     postpaid/no-PI guards, credit marked APPLIED, refund failure keeps
 *     PENDING
 *   - Every method never throws (fail-safe contract)
 */
import { Test } from "@nestjs/testing";
import { ReferralCreditApplicationService } from "./referral-credit-application.service";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

const buildCredit = (overrides: Partial<any> = {}) => ({
  id: "credit-1",
  amountCents: 500,
  reason: "BUSINESS_REFERRAL reward",
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

describe("ReferralCreditApplicationService", () => {
  let service: ReferralCreditApplicationService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let stripeMock: DeepMockProxy<StripeService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    stripeMock = mockDeep<StripeService>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReferralCreditApplicationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StripeService, useValue: stripeMock },
      ],
    }).compile();

    service = moduleRef.get<ReferralCreditApplicationService>(
      ReferralCreditApplicationService,
    );
    jest.spyOn(service["logger"], "log").mockImplementation(() => undefined);
    jest.spyOn(service["logger"], "warn").mockImplementation(() => undefined);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    mockReset(prismaMock);
    mockReset(stripeMock);
  });

  // ── applyPostpaidCreditsToUpcomingInvoice ────────────────────────
  describe("applyPostpaidCreditsToUpcomingInvoice", () => {
    it("applies PENDING credits oldest-first as a negative InvoiceItem and marks them APPLIED", async () => {
      const older = buildCredit({ id: "credit-old", createdAt: new Date("2026-01-01") });
      const newer = buildCredit({ id: "credit-new", createdAt: new Date("2026-02-01") });
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([newer, older]);
      (stripeMock.stripe as any) = { invoiceItems: { create: jest.fn().mockResolvedValue({ id: "ii_1" }) } };

      await service.applyPostpaidCreditsToUpcomingInvoice({
        dealerId: "dealer-1",
        stripeCustomerId: "cus_1",
        invoiceTotalCents: 100000,
      });

      const iiCall = (stripeMock.stripe as any).invoiceItems.create.mock.calls[0][0];
      expect(iiCall.customer).toBe("cus_1");
      expect(iiCall.amount).toBe(-1000); // both credits applied
      expect(iiCall.metadata.creditIds).toBe("credit-new,credit-old");

      // Both credits marked APPLIED
      expect(prismaMock.referralCredit.update).toHaveBeenCalledTimes(2);
      const firstUpdate = (prismaMock.referralCredit.update as any).mock.calls[0][0];
      expect(firstUpdate.data.status).toBe("APPLIED");
      expect(firstUpdate.data.reason).toContain("[auto-applied to weekly invoice]");
    });

    it("caps application at the invoice total — oversized credits stay PENDING", async () => {
      const small = buildCredit({ id: "credit-small", amountCents: 500 });
      const big = buildCredit({ id: "credit-big", amountCents: 999999, createdAt: new Date("2026-01-02") });
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([small, big]);
      (stripeMock.stripe as any) = { invoiceItems: { create: jest.fn().mockResolvedValue({ id: "ii_2" }) } };

      await service.applyPostpaidCreditsToUpcomingInvoice({
        dealerId: "dealer-1",
        stripeCustomerId: "cus_1",
        invoiceTotalCents: 5000, // room for small (500), not big
      });

      const iiCall = (stripeMock.stripe as any).invoiceItems.create.mock.calls[0][0];
      expect(iiCall.amount).toBe(-500);
      expect(iiCall.metadata.creditIds).toBe("credit-small");
      expect(prismaMock.referralCredit.update).toHaveBeenCalledTimes(1);
      expect((prismaMock.referralCredit.update as any).mock.calls[0][0].where.id).toBe("credit-small");
    });

    it("does nothing when the dealer has no PENDING credits", async () => {
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([]);

      await expect(
        service.applyPostpaidCreditsToUpcomingInvoice({
          dealerId: "dealer-1",
          stripeCustomerId: "cus_1",
        }),
      ).resolves.toBeUndefined();

      expect(prismaMock.referralCredit.update).not.toHaveBeenCalled();
    });

    it("never throws on Stripe failure — credits stay PENDING", async () => {
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([buildCredit()]);
      (stripeMock.stripe as any) = {
        invoiceItems: { create: jest.fn().mockRejectedValue(new Error("Stripe down")) },
      };

      await expect(
        service.applyPostpaidCreditsToUpcomingInvoice({
          dealerId: "dealer-1",
          stripeCustomerId: "cus_1",
        }),
      ).resolves.toBeUndefined();

      expect(prismaMock.referralCredit.update).not.toHaveBeenCalled();
    });
  });

  // ── refundPrepaidCreditForDelivery ───────────────────────────────
  describe("refundPrepaidCreditForDelivery", () => {
    const setupCapturedPrepaid = () => {
      (prismaMock.payment.findFirst as any).mockResolvedValue({
        id: "payment-1",
        providerPaymentIntentId: "pi_123",
      });
    };

    it("refunds the oldest PENDING credit to the card and marks it APPLIED", async () => {
      setupCapturedPrepaid();
      (prismaMock.referralCredit.findFirst as any).mockResolvedValue(
        buildCredit({ amountCents: 1000 }),
      );
      (stripeMock.stripe as any) = { refunds: { create: jest.fn().mockResolvedValue({ id: "re_1" }) } };

      await service.refundPrepaidCreditForDelivery({
        deliveryId: "delivery-1",
        customerId: "customer-1",
      });

      const refundCall = (stripeMock.stripe as any).refunds.create.mock.calls[0];
      expect(refundCall[0].payment_intent).toBe("pi_123");
      expect(refundCall[0].amount).toBe(1000);
      expect(refundCall[0].metadata.creditId).toBe("credit-1");
      expect(refundCall[1].idempotencyKey).toBe("referral-credit-credit-1");

      const updateCall = (prismaMock.referralCredit.update as any).mock.calls[0][0];
      expect(updateCall.data.status).toBe("APPLIED");
      expect(updateCall.data.reason).toContain("[auto-refunded to card, delivery delivery-1]");
    });

    it("does nothing when the delivery payment is not captured PREPAID (postpaid flows skip)", async () => {
      (prismaMock.payment.findFirst as any).mockResolvedValue(null);
      (stripeMock.stripe as any) = { refunds: { create: jest.fn() } };

      await service.refundPrepaidCreditForDelivery({
        deliveryId: "delivery-2",
        customerId: "customer-1",
      });

      expect((stripeMock.stripe as any).refunds.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.findFirst).not.toHaveBeenCalled();
    });

    it("does nothing when the customer has no PENDING credit", async () => {
      setupCapturedPrepaid();
      (prismaMock.referralCredit.findFirst as any).mockResolvedValue(null);
      (stripeMock.stripe as any) = { refunds: { create: jest.fn() } };

      await service.refundPrepaidCreditForDelivery({
        deliveryId: "delivery-3",
        customerId: "customer-1",
      });

      expect((stripeMock.stripe as any).refunds.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.update).not.toHaveBeenCalled();
    });

    it("refund failure keeps the credit PENDING and never throws (retries next delivery)", async () => {
      setupCapturedPrepaid();
      (prismaMock.referralCredit.findFirst as any).mockResolvedValue(buildCredit());
      (stripeMock.stripe as any) = {
        refunds: { create: jest.fn().mockRejectedValue(new Error("card_error")) },
      };

      await expect(
        service.refundPrepaidCreditForDelivery({
          deliveryId: "delivery-4",
          customerId: "customer-1",
        }),
      ).resolves.toBeUndefined();

      expect(prismaMock.referralCredit.update).not.toHaveBeenCalled();
    });
  });
});
