import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Response } from "express";
import { DriverPayoutService } from "./driverPayout.service";
import { DriverPayoutControllerBase } from "./base/driverPayout.controller.base";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";
import { Inject, Optional } from "@nestjs/common";

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

    const header = "Name,Amount,Currency,Routing Number,Account Number,Account Type,Payment Reference";
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

    return {
      availableBalance: Math.round(availableBalance * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      weeklyEarnings: Math.round(weeklyEarnings * 100) / 100,
      monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
      yearlyEarnings: Math.round(yearlyEarnings * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      payoutCount: payouts.length,
      payouts,
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
    return this.payoutEngine.processWeeklyAutoPayouts();
  }
}
