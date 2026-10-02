import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Response } from "express";
import { DriverPayoutService } from "./driverPayout.service";
import { DriverPayoutControllerBase } from "./base/driverPayout.controller.base";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";
import { Inject, Optional } from "@nestjs/common";
import {
  PayoutSettings,
  PAYOUT_SETTINGS_KEY,
  defaultPayoutSettings,
  describeWeeklyCron,
  normalizePayoutSettings,
} from "../appSetting/payout-settings";

@swagger.ApiTags("driverPayouts")
@common.Controller("driverPayouts")
export class DriverPayoutController extends DriverPayoutControllerBase {
  constructor(
    protected readonly service: DriverPayoutService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder,
    private readonly prisma: PrismaService,
    @Optional() @Inject(PaymentPayoutEngine)
    private readonly payoutEngine?: PaymentPayoutEngine,
  ) {
    super(service, rolesBuilder);
  }

  /**
   * Resolve the driver record from the authenticated user's JWT payload.
   * req.user only contains { id, username, roles } from the JWT — no profileId.
   * We look up the Driver table by userId to get the driverId.
   */
  private async resolveDriverId(req: any): Promise<string> {
    const userId = (req as any).user?.id;
    if (!userId) throw new common.UnauthorizedException('Not authenticated');

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) throw new common.NotFoundException('Driver profile not found');
    return driver.id;
  }

  /**
   * Live PAYOUT_SETTINGS for the driver wallet (cadence label + whether
   * manual cash-out is offered). Falls back to defaults on any failure —
   * the wallet must render even if the settings row is missing/broken.
   */
  private async getPayoutSettingsSafe(): Promise<PayoutSettings> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: PAYOUT_SETTINGS_KEY },
        select: { value: true },
      });
      return normalizePayoutSettings(row?.value);
    } catch {
      return { ...defaultPayoutSettings };
    }
  }

  /**
   * RESTORED by owner decision (was retired in the legacy bank-rail
   * cleanup): the Wise BatchTransfer CSV export is needed by admin and
   * insurance workflows.
   *
   * Exports payouts (default status: ELIGIBLE) as a Wise bulk-payment CSV
   * using the bank details stored in DriverBankAccount.
   *
   * NOTE: drivers who connected their bank via Stripe Connect Express do
   * NOT have a DriverBankAccount row — their bank details live with Stripe
   * only, so their rows export with "UNKNOWN" name and empty routing/
   * account fields. Those drivers are paid by the weekly Stripe sweep;
   * this CSV covers drivers whose bank details are stored in-app.
   */
  @common.Get("admin/export-wise-csv")
  @swagger.ApiOkResponse({ description: "Wise BatchTransfer CSV file" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "any",
  })
  async exportWiseBatchCsv(
    @common.Query("status") status?: string,
    @common.Res() res?: Response,
  ): Promise<void> {
    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.status = "ELIGIBLE";
    }

    const payouts = await this.service.driverPayouts({
      where,
      include: {
        driver: {
          include: {
            bankAccount: true,
            user: { select: { email: true } },
          },
        },
        delivery: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `wise-batch-${dateStr}.csv`;

    const header =
      "Name,Amount,Currency,Routing Number,Account Number,Account Type,Payment Reference";
    const rows = payouts.map((p: any) => {
      const ba = p.driver?.bankAccount;
      const name = ba?.accountHolderName || "UNKNOWN";
      const amount = p.netAmount.toFixed(2);
      const routing = ba?.routingNumber || "";
      const account = ba?.accountNumber || "";
      const type = ba?.accountType || "checking";
      const ref = `Driver Pay ${dateStr} - ${p.deliveryId}`;
      return `${name},${amount},USD,${routing},${account},${type},"${ref}"`;
    });

    const csv = [header, ...rows].join("\n");

    res!.setHeader("Content-Type", "text/csv");
    res!.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res!.send(csv);
  }

  /**
   * RESTORED by owner decision (was retired in the legacy bank-rail
   * cleanup): the in-app bank account endpoints feed DriverBankAccount,
   * which is the data source for the Wise BatchTransfer CSV export used
   * by admin and insurance workflows.
   */
  @common.Get("my-bank-account")
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "own",
  })
  async getMyBankAccount(@common.Req() req: any, @common.Res() res: Response): Promise<void> {
    const driverId = await this.resolveDriverId(req);

    const account = await this.prisma.driverBankAccount.findUnique({
      where: { driverId },
    });
    res.json(account || {});
  }

  @common.Post("my-bank-account")
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "update",
    possession: "own",
  })
  async upsertMyBankAccount(
    @common.Body() body: any,
    @common.Req() req: any,
  ): Promise<any> {
    const driverId = await this.resolveDriverId(req);

    const { accountHolderName, routingNumber, accountNumber, accountType, bankName } = body;

    if (!accountHolderName || !routingNumber || !accountNumber) {
      throw new common.BadRequestException("Account holder name, routing number, and account number are required");
    }

    return this.prisma.driverBankAccount.upsert({
      where: { driverId },
      create: {
        driverId,
        accountHolderName,
        routingNumber,
        accountNumber,
        accountType: accountType || "checking",
        bankName: bankName || null,
      },
      update: {
        accountHolderName,
        routingNumber,
        accountNumber,
        accountType: accountType || "checking",
        bankName: bankName || null,
      },
    });
  }

  @common.Get("my-earnings")
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "own",
  })
  async getMyEarnings(@common.Req() req: any): Promise<any> {
    const driverId = await this.resolveDriverId(req);

    const payouts = await this.prisma.driverPayout.findMany({
      where: { driverId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        grossAmount: true,
        driverSharePct: true,
        insuranceFee: true,
        platformFee: true,
        netAmount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            serviceType: true,
            pickupAddress: true,
            dropoffAddress: true,
            createdAt: true,
          },
        },
      },
    });

    // Aggregate totals
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let availableBalance = 0;
    let pendingAmount = 0;
    let weeklyEarnings = 0;
    let monthlyEarnings = 0;
    let yearlyEarnings = 0;
    let totalEarnings = 0;
    let totalTips = 0;

    for (const p of payouts) {
      const net = p.netAmount || 0;
      if (p.status === "ELIGIBLE") availableBalance += net;
      if (p.status === "PENDING") pendingAmount += net;

      totalEarnings += net;

      const created = new Date(p.createdAt);
      if (created >= startOfWeek) weeklyEarnings += net;
      if (created >= startOfMonth) monthlyEarnings += net;
      if (created >= startOfYear) yearlyEarnings += net;
    }

    // Include PENDING adjustments (late tips / clawbacks) in the available
    // balance so the wallet shows the SAME number the withdrawal math uses
    // (getDriverAvailableBalance) — otherwise the UI can display more (or
    // less) than the driver can actually be paid.
    let pendingAdjustmentSum = 0;
    try {
      const adjAgg = await this.prisma.driverPayoutAdjustment.aggregate({
        where: { driverId, status: "PENDING" },
        _sum: { amount: true },
      });
      pendingAdjustmentSum = Number(adjAgg._sum.amount || 0);
    } catch {
      // Non-fatal — adjustments are a refinement, not a requirement.
      pendingAdjustmentSum = 0;
    }
    availableBalance += pendingAdjustmentSum;
    availableBalance = Math.round(Math.max(0, availableBalance) * 100) / 100;

    const payoutSettings = await this.getPayoutSettingsSafe();

    return {
      availableBalance,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      weeklyEarnings: Math.round(weeklyEarnings * 100) / 100,
      monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
      yearlyEarnings: Math.round(yearlyEarnings * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      payoutCount: payouts.length,
      payouts,
      // Payout cadence for the wallet UI: the weekly sweep is THE rail,
      // so the app tells the driver when money moves instead of offering
      // manual cash-out (which is setting-gated).
      payoutConfig: {
        driverCashoutEnabled: payoutSettings.driverCashoutEnabled,
        autoTransferOnCompletion: payoutSettings.autoTransferOnCompletion,
        minimumWeeklyPayoutDollars: payoutSettings.minimumWeeklyPayoutDollars,
        weeklyPayoutSummary: describeWeeklyCron(payoutSettings),
      },
    };
  }

  // ── Withdrawal Endpoints ─────────────────────────────────────────

  @common.Post("request-withdrawal")
  @swagger.ApiOkResponse({ description: "Free withdrawal requested — 1-2 business days" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "update",
    possession: "own",
  })
  async requestWithdrawal(@common.Req() req: any): Promise<any> {
    if (!this.payoutEngine) {
      throw new common.ServiceUnavailableException('Payout service not available');
    }
    const driverId = await this.resolveDriverId(req);
    return this.payoutEngine.requestFreeWithdrawal(driverId);
  }

  @common.Post("request-instant-payout")
  @swagger.ApiOkResponse({ description: "Instant payout — arrives in minutes, $1.50 fee" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "update",
    possession: "own",
  })
  async requestInstantPayout(@common.Req() req: any): Promise<any> {
    if (!this.payoutEngine) {
      throw new common.ServiceUnavailableException('Payout service not available');
    }
    const driverId = await this.resolveDriverId(req);
    return this.payoutEngine.requestInstantPayout(driverId);
  }

  @common.Get("withdrawal-history")
  @swagger.ApiOkResponse({ description: "Driver withdrawal/batch history" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "own",
  })
  async getWithdrawalHistory(@common.Req() req: any): Promise<any> {
    if (!this.payoutEngine) {
      throw new common.ServiceUnavailableException('Payout service not available');
    }
    const driverId = await this.resolveDriverId(req);
    return this.payoutEngine.getDriverPayoutBatches(driverId);
  }

  @common.Post("admin/process-weekly-payouts")
  @swagger.ApiOkResponse({ description: "Process weekly auto-payouts for all eligible drivers" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "update",
    possession: "any",
  })
  async processWeeklyPayouts(): Promise<any> {
    if (!this.payoutEngine) {
      throw new common.ServiceUnavailableException('Payout service not available');
    }
    return this.payoutEngine.processWeeklyAutoPayouts('MANUAL');
  }

  // ── Weekly Transfer Run Report (admin dashboard) ──────────────

  /**
   * List weekly sweep runs, latest first. Each run carries the counts the
   * admin dashboard needs: how many driver transfers were attempted,
   * succeeded, failed, and skipped. Per-driver detail (with failure
   * reasons) is on the run detail endpoint.
   */
  @common.Get("admin/payout-runs")
  @swagger.ApiOkResponse({ description: "Weekly payout sweep runs (latest first)" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "any",
  })
  async listPayoutRuns(
    @common.Query("take") take?: string,
  ): Promise<any> {
    const parsed = Number(take);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : 25;

    const runs = await this.prisma.payoutSweepRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { _count: { select: { batches: true } } },
    });
    return { runs };
  }

  /**
   * Detail of one weekly sweep run: the run counters plus every driver
   * batch it created — amount, final status (COMPLETED / FAILED / still
   * in-flight), the Stripe transfer id, and the human-readable failure
   * reason when a transfer did not go through.
   */
  @common.Get("admin/payout-runs/:id")
  @swagger.ApiOkResponse({ description: "Weekly payout sweep run with per-driver results" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "any",
  })
  async getPayoutRun(@common.Param("id") id: string): Promise<any> {
    const run = await this.prisma.payoutSweepRun.findUnique({
      where: { id },
      include: {
        batches: {
          orderBy: { initiatedAt: "asc" },
          include: {
            driver: {
              include: { user: { select: { fullName: true, email: true } } },
            },
          },
        },
      },
    });
    if (!run) throw new common.NotFoundException("Payout run not found");

    const { batches, ...runFields } = run;
    return {
      run: runFields,
      results: batches.map((b: any) => ({
        batchId: b.id,
        driverId: b.driverId,
        driverName: b.driver?.user?.fullName || null,
        driverEmail: b.driver?.user?.email || null,
        amount: b.netPayoutAmount,
        status: b.status,
        failureReason: b.failureMessage || null,
        stripeTransferId: b.stripeTransferId || null,
        initiatedAt: b.initiatedAt,
        completedAt: b.completedAt,
        failedAt: b.failedAt,
      })),
    };
  }

  /**
   * Admin detail for a single driver payout (the View action on the
   * payouts report table): payout amounts + status, the delivery it came
   * from, and any payout batch the payout was settled through.
   */
  @common.Get("admin/payouts/:id")
  @swagger.ApiOkResponse({ description: "Single driver payout detail for admins" })
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "any",
  })
  async getAdminPayoutDetail(@common.Param("id") id: string): Promise<any> {
    const payout = await this.prisma.driverPayout.findUnique({
      where: { id },
      include: {
        driver: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            serviceType: true,
            pickupAddress: true,
            dropoffAddress: true,
            createdAt: true,
          },
        },
      },
    });
    if (!payout) throw new common.NotFoundException("Payout not found");

    const batchItems = await this.prisma.payoutBatchItem.findMany({
      where: { driverPayoutId: id },
      include: { batch: true },
    });

    const { driver, delivery, ...payoutFields } = payout as any;
    return {
      payout: payoutFields,
      driver: {
        id: driver?.id || null,
        name: driver?.user?.fullName || null,
        email: driver?.user?.email || null,
      },
      delivery,
      batches: batchItems.map((item: any) => ({
        batchId: item.batch?.id,
        type: item.batch?.type,
        status: item.batch?.status,
        amount: item.amount,
        failureReason: item.batch?.failureMessage || null,
        stripeTransferId: item.batch?.stripeTransferId || null,
        initiatedAt: item.batch?.initiatedAt,
        completedAt: item.batch?.completedAt,
      })),
    };
  }
}
