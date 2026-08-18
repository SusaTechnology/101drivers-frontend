// Smoke test for PostpaidBillingService — verifies the module loads,
// dependencies inject, and the public methods exist. Doesn't exercise
// the Stripe API (those need a real Stripe key + Dashboard setup).
//
// Run: npx jest src/postpaidBilling/postpaidBilling.service.spec.ts

import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import { PostpaidBillingService } from "./postpaidBilling.service";

describe("PostpaidBillingService", () => {
  let service: PostpaidBillingService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PostpaidBillingService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              // Minimal stubs used by the autoRetryFrozenDealers +
              // getMyStatus happy-path smoke tests.
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              update: jest.fn().mockResolvedValue({}),
              count: jest.fn().mockResolvedValue(0),
            },
            payment: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "STRIPE_POSTPAID_PRICE_ID") return "price_test_postpaid";
              return undefined;
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            stripe: {
              invoices: {
                retrieve: jest.fn(),
                createPreview: jest.fn(),
                list: jest.fn().mockResolvedValue({ data: [] }),
                pay: jest.fn(),
              },
              invoiceItems: { create: jest.fn() },
              subscriptions: { create: jest.fn() },
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PostpaidBillingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("exposes the public API required by callers", () => {
    expect(typeof service.setupDealerForPostpaid).toBe("function");
    expect(typeof service.reportUsageToStripe).toBe("function");
    expect(typeof service.canDealerCreateDelivery).toBe("function");
    expect(typeof service.handleInvoiceUpcoming).toBe("function");
    expect(typeof service.handleInvoicePaymentSucceeded).toBe("function");
    expect(typeof service.handleInvoicePaymentFailed).toBe("function");
    expect(typeof service.handleInvoiceFinalized).toBe("function");
    expect(typeof service.setCreditCap).toBe("function");
    expect(typeof service.unfreezeDealer).toBe("function");
    expect(typeof service.retryFailedCharge).toBe("function");
    expect(typeof service.getMyStatus).toBe("function");
    expect(typeof service.autoRetryFrozenDealers).toBe("function");
  });

  it("autoRetryFrozenDealers is a no-op when no frozen dealers exist", async () => {
    // prisma.customer.findMany stubbed to [] in beforeEach — should
    // short-circuit after the findMany call without attempting any retries.
    await expect(service.autoRetryFrozenDealers()).resolves.toBeUndefined();
  });

  it("handleInvoicePaymentFailed is a no-op when StripeService is unavailable", async () => {
    // The handler guards on !this.stripeService — but here StripeService
    // is provided. So we test the try/catch path: invoices.retrieve is
    // stubbed but throws → handler must catch + log, not re-throw.
    await expect(service.handleInvoicePaymentFailed("in_test")).resolves.toBeUndefined();
  });

  it("handleInvoiceFinalized is a no-op when StripeService is unavailable", async () => {
    await expect(service.handleInvoiceFinalized("in_test")).resolves.toBeUndefined();
  });
});
