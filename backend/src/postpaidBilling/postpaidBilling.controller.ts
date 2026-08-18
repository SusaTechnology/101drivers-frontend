// PostpaidBillingController — admin-only endpoints for managing dealer
// postpaid billing. The actual Stripe calls live in PostpaidBillingService;
// this controller only validates input + delegates.
//
// Routes are mounted under /api/postpaid-billing/*. Admin auth is enforced
// by the global JwtAuthGuard + ACL module (re-uses the existing admin
// guard pattern used elsewhere in the codebase).

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PostpaidBillingService } from "./postpaidBilling.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("postpaid-billing")
@Controller("postpaid-billing")
export class PostpaidBillingController {
  private readonly logger = new Logger(PostpaidBillingController.name);

  constructor(
    private readonly postpaidBilling: PostpaidBillingService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Setup ────────────────────────────────────────────────────

  @Post("dealers/:dealerId/setup")
  @ApiOperation({ summary: "Onboard an approved dealer onto weekly postpaid billing (creates Stripe Customer + $0/wk anchor subscription)" })
  async setupDealer(@Param("dealerId") dealerId: string) {
    return this.postpaidBilling.setupDealerForPostpaid(dealerId);
  }

  // ─── Cap ──────────────────────────────────────────────────────

  @Post("dealers/:dealerId/cap")
  @ApiOperation({ summary: "Set the per-dealer postpaid cap (cents, null = unlimited)" })
  async setCap(
    @Param("dealerId") dealerId: string,
    @Body() body: { capCents: number | null },
  ) {
    if (body.capCents !== null && typeof body.capCents !== "number") {
      throw new BadRequestException("capCents must be a number or null");
    }
    await this.postpaidBilling.setCreditCap(dealerId, body.capCents);
    return { ok: true, dealerId, capCents: body.capCents };
  }

  // ─── Freeze ───────────────────────────────────────────────────

  @Post("dealers/:dealerId/unfreeze")
  @ApiOperation({ summary: "Manually unfreeze a dealer after they fixed their card" })
  async unfreeze(@Param("dealerId") dealerId: string) {
    await this.postpaidBilling.unfreezeDealer(dealerId);
    return { ok: true, dealerId };
  }

  @Post("dealers/:dealerId/retry-charge")
  @ApiOperation({ summary: "Retry the most recent failed weekly invoice (Stripe.pay)" })
  async retryCharge(@Param("dealerId") dealerId: string) {
    await this.postpaidBilling.retryFailedCharge(dealerId);
    return { ok: true, dealerId };
  }

  // ─── Status / Inspect ────────────────────────────────────────

  @Get("dealers/:dealerId/status")
  @ApiOperation({ summary: "Inspect a dealer's postpaid billing state (cap, frozen, outstanding, weekly invoice summary)" })
  async getStatus(@Param("dealerId") dealerId: string) {
    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        businessName: true,
        postpaidEnabled: true,
        billingMode: true,
        billingFrozen: true,
        billingFrozenAt: true,
        billingFrozenReason: true,
        postpaidCreditLimitCents: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeDefaultPaymentMethodId: true,
        approvalStatus: true,
      },
    });

    if (!dealer) {
      throw new BadRequestException("Dealer not found");
    }

    // Outstanding balance — sum of unpaid postpaid Payments
    const unpaidPayments = await this.prisma.payment.findMany({
      where: {
        delivery: { customerId: dealerId },
        paymentType: "POSTPAID",
        status: { in: ["PENDING_STRIPE_USAGE", "USAGE_REPORTED", "CHARGE_FAILED", "AUTHORIZED", "INVOICED"] },
      },
      select: { id: true, amount: true, status: true, stripeInvoiceItemId: true, deliveryId: true },
    });

    const outstandingCents = unpaidPayments.reduce(
      (sum, p) => sum + Math.round(Number(p.amount) * 100),
      0,
    );

    return {
      dealerId: dealer.id,
      businessName: dealer.businessName,
      approvalStatus: dealer.approvalStatus,
      postpaidEnabled: dealer.postpaidEnabled,
      billingMode: dealer.billingMode,
      billingFrozen: dealer.billingFrozen,
      billingFrozenAt: dealer.billingFrozenAt,
      billingFrozenReason: dealer.billingFrozenReason,
      capCents: dealer.postpaidCreditLimitCents, // null = unlimited
      outstandingCents,
      outstandingDollars: Number((outstandingCents / 100).toFixed(2)),
      unpaidDeliveryCount: unpaidPayments.length,
      stripe: {
        customerId: dealer.stripeCustomerId,
        subscriptionId: dealer.stripeSubscriptionId,
        defaultPaymentMethodId: dealer.stripeDefaultPaymentMethodId,
      },
      unpaidPayments: unpaidPayments.map((p) => ({
        paymentId: p.id,
        deliveryId: p.deliveryId,
        amount: p.amount,
        status: p.status,
        stripeInvoiceItemId: p.stripeInvoiceItemId,
      })),
    };
  }
}
