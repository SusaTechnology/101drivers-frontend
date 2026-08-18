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
        { provide: PrismaService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "STRIPE_POSTPAID_PRICE_ID") return "price_test_postpaid";
              return undefined;
            },
          },
        },
        { provide: StripeService, useValue: { stripe: {} } },
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
    expect(typeof service.setCreditCap).toBe("function");
    expect(typeof service.unfreezeDealer).toBe("function");
    expect(typeof service.retryFailedCharge).toBe("function");
  });
});
