// PostpaidBillingController — admin + dealer-scoped endpoints for managing
// dealer postpaid billing. The actual Stripe calls live in
// PostpaidBillingService; this controller only validates input + delegates.
//
// Routes are mounted under /api/postpaid-billing/*. Auth is enforced by
// the global JwtAuthGuard + ACL module.
//
// Endpoints split:
//   • /dealers/:dealerId/* — ADMIN-ONLY (setup, cap, unfreeze, retry-charge,
//     status). Dealers cannot call these on themselves or others.
//   • /me/status — DEALER-SCOPED. Resolves the dealerId from the JWT user,
//     never trusts a body/param dealerId. Returns a redacted subset of the
//     admin status (no per-payment breakdown — dealer gets that from the
//     Stripe invoice PDF).
//   • /cron/auto-retry — internal trigger (no HTTP route; the @Cron
//     decorator calls autoRetryFrozenDealers daily at 06:00 server time).

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import * as nestAccessControl from "nest-access-control";
import { UserData } from "../auth/userData.decorator";
import { User } from "@prisma/client";
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

  // ─── ADMIN: Setup ────────────────────────────────────────────

  @Post("dealers/:dealerId/setup")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Onboard an approved dealer onto weekly postpaid billing (creates Stripe Customer + $0/wk anchor subscription)" })
  async setupDealer(@Param("dealerId") dealerId: string) {
    return this.postpaidBilling.setupDealerForPostpaid(dealerId);
  }

  // ─── ADMIN: Cap ──────────────────────────────────────────────

  @Post("dealers/:dealerId/cap")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
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

  // ─── ADMIN: Freeze ───────────────────────────────────────────

  @Post("dealers/:dealerId/unfreeze")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Manually unfreeze a dealer after they fixed their card" })
  async unfreeze(@Param("dealerId") dealerId: string) {
    await this.postpaidBilling.unfreezeDealer(dealerId);
    return { ok: true, dealerId };
  }

  @Post("dealers/:dealerId/retry-charge")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Retry the most recent failed weekly invoice (Stripe.pay)" })
  async retryCharge(@Param("dealerId") dealerId: string) {
    await this.postpaidBilling.retryFailedCharge(dealerId);
    return { ok: true, dealerId };
  }

  // ─── ADMIN: Billing Mode Switch ────────────────────────────

  @Get("dealers/:dealerId/switch-check")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Pre-check: can the admin switch this dealer's billing mode?" })
  async getSwitchEligibility(@Param("dealerId") dealerId: string) {
    return this.postpaidBilling.getSwitchEligibility(dealerId);
  }

  @Post("dealers/:dealerId/switch-billing")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Safely switch a dealer between prepaid and postpaid billing" })
  async switchBillingMode(
    @Param("dealerId") dealerId: string,
    @Body() body: { mode: 'PREPAID' | 'POSTPAID' },
  ) {
    const result = await this.postpaidBilling.switchBillingMode(dealerId, body.mode);
    return { ok: true, dealerId, ...result };
  }

  // ─── ADMIN: Status / Inspect ────────────────────────────────

  @Get("dealers/:dealerId/status")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
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

  // ─── DEALER: Self-service status ─────────────────────────────
  //
  // Dealers call this to render their "Weekly Postpaid" panel —
  // outstanding balance, frozen banner, next invoice date, cap usage.
  //
  // Auth: any authenticated user. We resolve the dealerId from the
  // JWT user → Customer row. If the authenticated user has no Customer
  // row (driver/admin), we return 404. We never trust a dealerId
  // passed in the URL or body for this route — a dealer must not be
  // able to query another dealer's status.

  @Get("me/status")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard)
  @ApiOperation({ summary: "Get the authenticated dealer's own postpaid billing status (outstanding, frozen, next invoice)" })
  async getMyStatus(@UserData() user: User) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      // User isn't a dealer (driver/admin). Don't leak our internal data
      // model — return a plain English message so the toast on the dealer
      // portal doesn't say "Customer record".
      throw new BadRequestException(
        "Postpaid billing is only available for business dealer accounts. " +
          "If you believe this is an error, please contact support.",
      );
    }
    return this.postpaidBilling.getMyStatus(customer.id);
  }

  // ─── CRON: auto-retry frozen dealers ──────────────────────────
  //
  // Runs daily at 06:00 server time. Finds every dealer that is
  // frozen with reason CHARGE_FAILED AND has a saved payment method,
  // and retries their most recent failed weekly invoice. If the
  // retry succeeds, the payment_succeeded webhook clears the freeze;
  // if it fails again, the payment_failed webhook re-freezes (no-op
  // due to the idempotency guard in handleInvoicePaymentFailed).
  //
  // This unblocks dealers whose card failed once and who subsequently
  // added a new card via the saved-card flow, without requiring
  // admin intervention.

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyAutoRetry() {
    this.logger.log("Daily auto-retry cron: starting");
    try {
      await this.postpaidBilling.autoRetryFrozenDealers();
    } catch (err: any) {
      this.logger.error(
        `Daily auto-retry cron failed: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ── CRON: usage report retry queue (Fix #1) ──────────────────────
  //
  // Runs every hour. Picks up Payment rows with `usageReportStatus = FAILED`
  // and `usageReportNextRetryAt <= now()`, and retries the
  // `reportUsageToStripe` call. Exponential backoff (1h, 2h, 4h, 8h, 24h)
  // is handled by `scheduleUsageReportRetry` in the service.
  //
  // After 5 attempts (~39h total), the row is marked PERMANENTLY_FAILED
  // and the admin must manually create the InvoiceItem in Stripe.
  //
  // This is the structural fix for the silent money-loss bug where a
  // transient Stripe outage during delivery completion would lose the
  // money for that delivery — no InvoiceItem was created, no retry was
  // scheduled, the weekly invoice just didn't include that delivery.

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyUsageReportRetry() {
    this.logger.log("Hourly usage report retry cron: starting");
    try {
      const result = await this.postpaidBilling.processUsageReportRetryQueue();
      if (result.processed > 0) {
        this.logger.log(
          `Hourly usage report retry cron: processed=${result.processed}, ` +
          `succeeded=${result.succeeded}, failed=${result.failed}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Hourly usage report retry cron failed: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ── CRON: mid-trip remainder charge retry queue (Fix #7) ──────────
  //
  // Runs daily at 06:00 server time (alongside the auto-retry cron).
  // Picks up Payment rows with `remainderChargeStatus = PENDING` and
  // retries the remainder charge if the customer has since added a new
  // card. Marks as UNCOLLECTIBLE after 7 days past the due date — the
  // admin must manually invoice the customer at that point.
  //
  // This is the structural fix for the "customer removes card between
  // startTrip and completeTrip" bug — the platform delivered the
  // service but didn't get paid the remainder. The driver did the
  // work, so we can't cancel the delivery — we have to chase the
  // remainder.

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyRemainderChargeRetry() {
    this.logger.log("Daily remainder charge retry cron: starting");
    try {
      const result = await this.postpaidBilling.processRemainderChargeRetryQueue();
      if (result.processed > 0) {
        this.logger.log(
          `Daily remainder charge retry cron: processed=${result.processed}, ` +
          `succeeded=${result.succeeded}, failed=${result.failed}, uncollectible=${result.uncollectible}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Daily remainder charge retry cron failed: ${err?.message}`,
        err?.stack,
      );
    }
  }
}
