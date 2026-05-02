import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import type { Response } from "express";

import { ReportsService } from "./reports.service";
import {
  ComplianceReportQueryDto,
  DeliveriesReportQueryDto,
  DisputesReportQueryDto,
  InsuranceMileageReportQueryDto,
  PaymentsReportQueryDto,
  PayoutsReportQueryDto,
} from "./dto/report-query.dto";

@swagger.ApiTags("reports")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
@common.Controller("reports")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    @nestAccessControl.InjectRolesBuilder()
    private readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {}

  private sendReportResult(res: Response, result: any) {
    if (result?.buffer && result?.contentType && result?.filename) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      return res.send(result.buffer);
    }

    return res.json(result);
  }

  @common.Get("deliveries")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async getDeliveries(
    @common.Query() query: DeliveriesReportQueryDto,
    @common.Res() res: Response
  ) {
    const result = await this.service.deliveries(query);
    return this.sendReportResult(res, result);
  }

  @common.Get("compliance")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async getCompliance(
    @common.Query() query: ComplianceReportQueryDto,
    @common.Res() res: Response
  ) {
    const result = await this.service.compliance(query);
    return this.sendReportResult(res, result);
  }

  @common.Get("disputes")
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "read",
    possession: "any",
  })
  async getDisputes(
    @common.Query() query: DisputesReportQueryDto,
    @common.Res() res: Response
  ) {
    const result = await this.service.disputes(query);
    return this.sendReportResult(res, result);
  }

  @common.Get("payments")
  @nestAccessControl.UseRoles({
    resource: "Payment",
    action: "read",
    possession: "any",
  })
  async getPayments(
    @common.Query() query: PaymentsReportQueryDto,
    @common.Res() res: Response
  ) {
    const result = await this.service.payments(query);
    return this.sendReportResult(res, result);
  }

  @common.Get("payouts")
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "any",
  })
  async getPayouts(
    @common.Query() query: PayoutsReportQueryDto,
    @common.Res() res: Response
  ) {
    const result = await this.service.payouts(query);
    return this.sendReportResult(res, result);
  }

  @common.Get("insurance-mileage")
  @nestAccessControl.UseRoles({
    resource: "TrackingSession",
    action: "read",
    possession: "any",
  })
  async getInsuranceMileage(
    @common.Query() query: InsuranceMileageReportQueryDto,
    @common.Res() res: Response
  ) {
    const result = await this.service.insuranceMileage(query);
    return this.sendReportResult(res, result);
  }
}