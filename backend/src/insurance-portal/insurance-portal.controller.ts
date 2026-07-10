import * as common from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import type { Response } from "express";
import { ReportsService } from "../reports/reports.service";
import { InsuranceMileageReportQueryDto } from "../reports/dto/report-query.dto";
import { REPORT_COLUMNS } from "../reports/export/report-column.definitions";
import { PrismaService } from "../prisma/prisma.service";

const PORTAL_PASSWORD_KEY = "INSURANCE_PORTAL_PASSWORD";

/**
 * Insurance Portal Controller
 *
 * 1. Portal endpoints (password-only auth via X-Portal-Password header — no JWT):
 *    GET  /api/insurance-portal/report   — report data (JSON)
 *    GET  /api/insurance-portal/columns  — available columns
 *    GET  /api/insurance-portal/export   — CSV/XLSX/PDF export
 *
 * 2. Admin endpoints (JWT + admin RBAC):
 *    GET  /api/insurance-portal/password  — get current password
 *    POST /api/insurance-portal/password  — set new password
 *
 * Password is stored in the AppSetting table — admin can change it from
 * the admin panel. No env vars, no server restart.
 */
@swagger.ApiTags("insurance-portal")
@common.Controller("insurance-portal")
export class InsurancePortalController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Password helpers (read/write from AppSetting table) ──

  private async getPortalPassword(): Promise<string | null> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: PORTAL_PASSWORD_KEY },
    });
    if (!setting) return null;
    const val = setting.value as any;
    return typeof val === "string" ? val : val?.password ?? null;
  }

  private async setPortalPassword(password: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: PORTAL_PASSWORD_KEY },
      update: { value: password as any },
      create: { key: PORTAL_PASSWORD_KEY, value: password as any },
    });
  }

  private async validatePassword(headers: Record<string, any>) {
    const portalPassword = await this.getPortalPassword();
    if (!portalPassword) {
      throw new common.BadRequestException(
        "Insurance portal password is not set. An admin must set it from the admin panel."
      );
    }
    const provided = headers["x-portal-password"] || headers["X-Portal-Password"];
    if (!provided || provided !== portalPassword) {
      throw new common.UnauthorizedException("Invalid portal password");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Portal endpoints (password-only — no JWT)
  // ═══════════════════════════════════════════════════════════════

  @common.Get("report")
  async getReport(
    @common.Headers() headers: Record<string, any>,
    @common.Query() query: InsuranceMileageReportQueryDto,
    @common.Res({ passthrough: false }) res: Response
  ) {
    await this.validatePassword(headers);
    query.format = "json";
    const result = await this.reportsService.insuranceMileage(query);
    return res.json(result);
  }

  @common.Get("columns")
  async getColumns(@common.Headers() headers: Record<string, any>) {
    await this.validatePassword(headers);
    return {
      reportKey: "insurance-mileage",
      columns: REPORT_COLUMNS["insurance-mileage"] ?? [],
    };
  }

  @common.Get("export")
  async exportReport(
    @common.Headers() headers: Record<string, any>,
    @common.Query() query: InsuranceMileageReportQueryDto,
    @common.Query("columns") columnsParam: string,
    @common.Res({ passthrough: false }) res: Response
  ) {
    await this.validatePassword(headers);
    if (!query.format || query.format === "json") {
      throw new common.BadRequestException(
        "Format is required for export. Use csv, xlsx, or pdf."
      );
    }
    // Force columns onto the query object — bypasses any DTO transformation issues
    const queryWithColumns = {
      ...query,
      columns: columnsParam || undefined,
    } as any;
    const result = await this.reportsService.insuranceMileage(queryWithColumns);
    const exportResult = result as any;
    if (exportResult?.buffer && exportResult?.contentType && exportResult?.filename) {
      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.filename}"`
      );
      return res.send(exportResult.buffer);
    }
    return res.json(result);
  }

  // ═══════════════════════════════════════════════════════════════
  // Admin endpoints (JWT + admin RBAC)
  // ═══════════════════════════════════════════════════════════════

  @common.Get("password")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "read", possession: "any" })
  async getPassword() {
    const password = await this.getPortalPassword();
    return { password: password ?? "", isSet: !!password };
  }

  @common.Post("password")
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @nestAccessControl.UseRoles({ resource: "User", action: "update", possession: "any" })
  async setPassword(@common.Body() body: { password: string }) {
    if (!body?.password || body.password.length < 4) {
      throw new common.BadRequestException(
        "Password is required and must be at least 4 characters."
      );
    }
    await this.setPortalPassword(body.password);
    return { success: true, message: "Insurance portal password updated." };
  }
}
