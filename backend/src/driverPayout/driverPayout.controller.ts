import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Response } from "express";
import { DriverPayoutService } from "./driverPayout.service";
import { DriverPayoutControllerBase } from "./base/driverPayout.controller.base";
import { PrismaService } from "../prisma/prisma.service";

@swagger.ApiTags("driverPayouts")
@common.Controller("driverPayouts")
export class DriverPayoutController extends DriverPayoutControllerBase {
  constructor(
    protected readonly service: DriverPayoutService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder,
    private readonly prisma: PrismaService
  ) {
    super(service, rolesBuilder);
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
  async getMyBankAccount(@common.Req() req: any): Promise<any> {
    const driverId = (req.user as any)?.driver?.id;
    if (!driverId) throw new common.NotFoundException("Driver profile not found");

    const account = await this.prisma.driverBankAccount.findUnique({
      where: { driverId },
    });
    return account;
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
    const driverId = (req.user as any)?.driver?.id;
    if (!driverId) throw new common.NotFoundException("Driver profile not found");

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
}
