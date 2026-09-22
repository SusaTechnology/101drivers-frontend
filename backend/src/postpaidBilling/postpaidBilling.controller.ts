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
  OnApplicationBootstrap,
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
import { BillingReconciliationService } from "./billing-reconciliation.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("postpaid-billing")
@Controller("postpaid-billing")
export class PostpaidBillingController implements OnApplicationBootstrap {
  private readonly logger = new Logger(PostpaidBillingController.name);

  // ── Cron lock (in-memory, single-process) ──
  // Prevents overlapping runs of the same cron. If a cron takes longer
  // than its interval (e.g. a Stripe outage causes the previous run to
  // still be running when the next interval fires), the new run skips.
  //
  // This is a single-process lock — if you run multiple backend
  // instances behind a load balancer, each instance has its own lock
  // and they can run the same cron concurrently. For multi-instance
  // safety, upgrade this to a DB-based lock (e.g. `SELECT FOR UPDATE`
  // on a cron_lock row) or use Redis with `SET NX EX`.
  //
  // The cron methods themselves are idempotent (unique constraints +
  // status checks), so even a concurrent run won't double-charge —
  // it'll just do redundant work + waste Stripe API quota.
  //
  // Lock registry: cronName → timestamp (ms) when the lock was acquired.
  private static readonly runningCrons = new Map<string, number>();

  // A run that has held its lock longer than this is presumed dead/hung
  // (e.g. a Stripe call that never returned). The lock is force-released
  // so subsequent runs aren't blocked forever — without this, one wedged
  // run would silently skip every future run AND keep the admin trigger
  // returning "already running" until the process restarted. Legit runs
  // take seconds (the backfill caps at 100 Stripe calls); 30 min is a
  // generous bound.
  private static readonly CRON_LOCK_STALE_MS = 30 * 60 * 1000;

  // Last result of the missing-usage backfill (daily cron, boot
  // catch-up, or admin trigger) — surfaced on /admin/health so "is the
  // sweep actually running?" has a visible answer.
  private static lastMissingUsageBackfillRun?: {
    at: string;
    trigger: string;
    found: number;
    processed: number;
    succeeded: number;
    failed: number;
  };

  private async withCronLock<T>(
    cronName: string,
    fn: () => Promise<T>,
  ): Promise<T | void> {
    const acquiredAt = PostpaidBillingController.runningCrons.get(cronName);
    if (acquiredAt !== undefined) {
      if (Date.now() - acquiredAt < PostpaidBillingController.CRON_LOCK_STALE_MS) {
        this.logger.warn(
          `Cron ${cronName} already running — skipping this execution. ` +
            `(Previous run may be taking longer than the interval. Consider tuning the batch size.)`,
        );
        return;
      }
      // Stale lock — previous run presumed dead. Force-release and run.
      this.logger.warn(
        `Cron ${cronName} lock is stale (held > ${PostpaidBillingController.CRON_LOCK_STALE_MS / 60000} min) — force-releasing and re-running.`,
      );
      PostpaidBillingController.runningCrons.delete(cronName);
    }
    PostpaidBillingController.runningCrons.set(cronName, Date.now());
    try {
      return await fn();
    } finally {
      PostpaidBillingController.runningCrons.delete(cronName);
    }
  }

  /**
   * Shared entry point for the missing-usage backfill — used by the
   * daily cron, the boot catch-up, and the admin endpoint. All three
   * share ONE lock name ("missingUsageBackfill") so they can never run
   * concurrently, and all three record their result for /admin/health.
   *
   * Returns undefined when the lock was held (caller decides whether
   * that's a skip-and-log or an error).
   */
  private async runMissingUsageBackfill(
    trigger: string,
    input?: { dealerId?: string; limit?: number },
  ): Promise<
    | { found: number; processed: number; succeeded: number; failed: number }
    | undefined
  > {
    const result = await this.withCronLock("missingUsageBackfill", () =>
      this.postpaidBilling.backfillMissingUsageReports(input),
    );
    if (!result) return undefined;
    PostpaidBillingController.lastMissingUsageBackfillRun = {
      at: new Date().toISOString(),
      trigger,
      ...result,
    };
    return result;
  }

  /**
   * Boot catch-up sweep. @nestjs/schedule does NOT replay a cron that
   * fired while the process was down — a deploy/restart around 03:00
   * would otherwise skip the sweep for the whole day. Run it once
   * shortly after every boot instead: the sweep is idempotent and
   * count-first (zero Stripe calls when nothing is stranded), so this
   * is cheap. Delayed so the app finishes wiring up (DB pool, etc.).
   */
  onApplicationBootstrap() {
    setTimeout(() => {
      this.runMissingUsageBackfill("boot-catchup")
        .then((result) => {
          if (result && result.found > 0) {
            this.logger.log(
              `Boot catch-up backfill: found=${result.found}, processed=${result.processed}, ` +
                `succeeded=${result.succeeded}, failed=${result.failed}`,
            );
          }
        })
        .catch((err: any) => {
          this.logger.error(
            `Boot catch-up backfill failed: ${err?.message}`,
            err?.stack,
          );
        });
    }, 60_000);
  }

  constructor(
    private readonly postpaidBilling: PostpaidBillingService,
    private readonly reconciliation: BillingReconciliationService,
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
  @ApiOperation({ summary: "Retry ALL open (failed) weekly invoices via Stripe — returns per-invoice outcome counts" })
  async retryCharge(@Param("dealerId") dealerId: string) {
    const result = await this.postpaidBilling.retryFailedCharge(dealerId);
    return { ok: true, dealerId, ...result };
  }

  // ─── ADMIN: Backfill missing usage reports ──────────────────

  @Post("dealers/:dealerId/backfill-usage")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Re-report completed deliveries whose usage was never sent to Stripe (stuck AUTHORIZED) — adds them to the next weekly invoice" })
  async backfillUsage(@Param("dealerId") dealerId: string) {
    // Shares the "missingUsageBackfill" lock with the daily cron and the
    // boot catch-up — they can never run concurrently (reportUsageToStripe
    // is idempotent, but avoid redundant Stripe calls).
    const result = await this.runMissingUsageBackfill(
      `admin-trigger:${dealerId}`,
      { dealerId },
    );
    if (!result) {
      // Lock was held (e.g. the 03:00 cron is mid-run) — tell the admin
      // nothing happened instead of returning misleading zero counts.
      throw new BadRequestException(
        "A usage backfill is already running — try again in a few minutes.",
      );
    }
    return { ok: true, dealerId, ...result };
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

    // Stranded usage reports — completed deliveries whose payment is
    // stuck in a pre-report state (never sent to Stripe). These freeze
    // the outstanding balance at a constant number; the admin can heal
    // them via POST /dealers/:id/backfill-usage.
    const missingUsage = await this.postpaidBilling.getMissingUsageReportStats(
      dealerId,
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
      missingUsageReports: {
        count: missingUsage.count,
        totalCents: missingUsage.totalCents,
        totalDollars: Number((missingUsage.totalCents / 100).toFixed(2)),
      },
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
      await this.withCronLock("dailyAutoRetry", async () => {
        await this.postpaidBilling.autoRetryFrozenDealers();
      });
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
      await this.withCronLock("hourlyUsageReportRetry", async () => {
        const result = await this.postpaidBilling.processUsageReportRetryQueue();
        if (result.processed > 0) {
          this.logger.log(
            `Hourly usage report retry cron: processed=${result.processed}, ` +
            `succeeded=${result.succeeded}, failed=${result.failed}`,
          );
        }
      });
    } catch (err: any) {
      this.logger.error(
        `Hourly usage report retry cron failed: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ── CRON: missing usage report backfill ──────────────────────────
  //
  // Runs daily at 03:00 server time. Finds POSTPAID payments stuck in
  // AUTHORIZED/INVOICED whose delivery COMPLETED but whose usage was
  // never reported to Stripe — these never enter the hourly retry
  // queue (silent skips don't set usageReportStatus), so without this
  // sweep they'd freeze the dealer's outstanding balance forever.
  // Re-reports them so they join the normal weekly invoice lifecycle.

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyMissingUsageBackfill() {
    this.logger.log("Daily missing-usage backfill cron: starting");
    try {
      const result = await this.runMissingUsageBackfill("daily-cron-3am");
      if (result && result.found > 0) {
        this.logger.log(
          `Daily missing-usage backfill cron: found=${result.found}, ` +
            `processed=${result.processed}, succeeded=${result.succeeded}, failed=${result.failed}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Daily missing-usage backfill cron failed: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ── CRON: nightly billing reconciliation (C1+C2+C4) ─────────────
  // Runs daily at 04:00 server time — after the 3AM usage backfill, before
  // the 6AM auto-retry, so repairs land before the retry pass.
  //
  // 1. Audit every WEEKLY_POSTPAID dealer's Stripe objects vs our DB
  //    (subscription ownership, default payment method, attachment) with
  //    safe auto-repairs. Findings → BillingAuditFinding rows.
  // 2. Invoice-state backfill: re-run idempotent invoice.* handlers for
  //    recent invoices whose DB rows are stale (missed webhook recovery).
  //
  // Never charges anything — the only Stripe write is re-pointing the
  // invoice default to a card we already believe is the dealer's default.

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleDailyBillingReconciliation() {
    this.logger.log("Daily billing reconciliation cron: starting");
    try {
      await this.withCronLock("billingReconciliation", async () => {
        await this.reconciliation.runNightlyReconciliation();
        await this.reconciliation.runInvoiceStateBackfill();
      });
    } catch (err: any) {
      this.logger.error(
        `Daily billing reconciliation cron failed: ${err?.message}`,
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
      await this.withCronLock("dailyRemainderChargeRetry", async () => {
        const result = await this.postpaidBilling.processRemainderChargeRetryQueue();
        if (result.processed > 0) {
          this.logger.log(
            `Daily remainder charge retry cron: processed=${result.processed}, ` +
            `succeeded=${result.succeeded}, failed=${result.failed}, uncollectible=${result.uncollectible}`,
          );
        }
      });
    } catch (err: any) {
      this.logger.error(
        `Daily remainder charge retry cron failed: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ── ADMIN: monitoring endpoint (Fix #11 — observability) ────────
  //
  // Returns queue depths + counts so the admin can monitor cron health
  // and detect issues early. Recommended alerting thresholds:
  //   • usageReportQueue > 50 → Stripe outage or persistent failure
  //   • usageReportPermanentlyFailed > 0 → admin must manually intervene
  //   • remainderQueue > 10 → many customers removing cards (UX issue)
  //   • remainderUncollectible > 0 → admin must manually invoice
  //   • pendingAdjustments > 20 → admin should trigger manual payout
  //     (the cron applies them on the next driver payout, but if the
  //     driver has been inactive, the adjustments pile up)
  //
  // Usage: GET /api/postpaid-billing/admin/health
  // Auth: admin only (defaultAuthGuard + ACGuard).

  @Get("admin/health")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Admin: monitor payment resilience queue depths + alert counts" })
  async getAdminHealth() {
    const now = new Date();
    const missingUsage = await this.postpaidBilling.getMissingUsageReportStats();
    const [
      usageReportQueue,
      usageReportPermanentlyFailed,
      remainderQueue,
      remainderUncollectible,
      pendingAdjustments,
      appliedAdjustments,
    ] = await Promise.all([
      this.prisma.payment.count({
        where: { usageReportStatus: 'FAILED', usageReportNextRetryAt: { lte: now } },
      }),
      this.prisma.payment.count({
        where: { usageReportStatus: 'PERMANENTLY_FAILED' },
      }),
      this.prisma.payment.count({
        where: { remainderChargeStatus: 'PENDING' },
      }),
      this.prisma.payment.count({
        where: { remainderChargeStatus: 'UNCOLLECTIBLE' },
      }),
      this.prisma.driverPayoutAdjustment.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.driverPayoutAdjustment.count({
        where: { status: 'APPLIED' },
      }),
    ]);

    return {
      timestamp: now.toISOString(),
      runningCrons: Array.from(PostpaidBillingController.runningCrons.keys()),
      queues: {
        usageReport: {
          pendingRetry: usageReportQueue,
          permanentlyFailed: usageReportPermanentlyFailed,
          // Recommended alert: usageReportPermanentlyFailed > 0
          alert: usageReportPermanentlyFailed > 0
            ? 'admin_intervention_required'
            : usageReportQueue > 50
              ? 'stripe_outage_suspected'
              : 'ok',
        },
        missingUsageReports: {
          count: missingUsage.count,
          totalCents: missingUsage.totalCents,
          // Completed deliveries that never reached Stripe — the daily
          // backfill cron + boot catch-up heal these automatically; an
          // admin can also trigger POST /dealers/:id/backfill-usage.
          alert: missingUsage.count > 0 ? "backfill_available" : "ok",
          // Last sweep result — answers "is this actually running?"
          lastRun: PostpaidBillingController.lastMissingUsageBackfillRun ?? null,
        },
        remainderCharges: {
          pending: remainderQueue,
          uncollectible: remainderUncollectible,
          // Recommended alert: uncollectible > 0 → admin must invoice
          alert: remainderUncollectible > 0
            ? 'admin_intervention_required'
            : remainderQueue > 10
              ? 'many_customers_losing_cards'
              : 'ok',
        },
        driverPayoutAdjustments: {
          pending: pendingAdjustments,
          applied: appliedAdjustments,
          // Recommended alert: pending > 20 → trigger manual payout
          alert: pendingAdjustments > 20
            ? 'trigger_manual_payout'
            : 'ok',
        },
      },
    };
  }

  // ── ADMIN: billing health overview (names, not just counts) ─────
  //
  // Powers the admin "Billing Health" page: frozen dealers, dealers
  // with failed charges that haven't hit the freeze threshold yet,
  // and uncollectible remainder charges — each with business name,
  // contact email, outstanding amounts, and card status so the admin
  // can act (retry-charge / unfreeze are the existing per-dealer
  // endpoints the page calls) without opening profiles one by one.
  //
  // Usage: GET /api/postpaid-billing/admin/billing-health
  // Auth: admin only (defaultAuthGuard + ACGuard).

  @Get("admin/billing-health")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Admin: dealers needing billing help, by name — frozen, failing (pre-freeze), and uncollectible" })
  async getBillingHealth() {
    return this.postpaidBilling.getBillingHealthOverview();
  }

  // ── ADMIN: one-click repair for DEFAULT_PM_DRIFT findings ─────────
  //
  // Re-sets the Stripe customer's invoice default from our DB record —
  // the manual counterpart of the nightly auto-repair, for when an admin
  // wants to fix a drift finding immediately instead of waiting for the
  // 4AM audit.
  //
  // Usage: POST /api/postpaid-billing/admin/dealers/:dealerId/repair-default
  // Auth: admin only (defaultAuthGuard + ACGuard).

  @Post("admin/dealers/:dealerId/repair-default")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @ApiOperation({ summary: "Admin: re-set the Stripe invoice default from our DB (DEFAULT_PM_DRIFT repair)" })
  async repairDefault(@Param("dealerId") dealerId: string) {
    return this.postpaidBilling.repairStripeDefaultFromDb(dealerId);
  }
}
