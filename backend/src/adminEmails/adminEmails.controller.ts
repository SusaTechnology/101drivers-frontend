import * as common from "@nestjs/common";
import { StreamableFile } from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { Request } from "express";
import { AdminEmailsService } from "./adminEmails.service";
import {
  AdminEmailsListQueryDto,
  AdminEmailsListResponseDto,
  AdminEmailsStatsResponseDto,
} from "./dto/adminEmails.dto";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AdminGuard } from "../auth/adminAuth.guard";

/**
 * Admin view over the emails the system actually sent (NotificationEvent
 * ledger, EMAIL channel). Read-only — the ledger is written by the
 * notification engines only, never from here.
 */
@swagger.ApiTags("adminEmails")
@common.Controller("adminEmails")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, AdminGuard)
export class AdminEmailsController {
  constructor(private readonly service: AdminEmailsService) {}

  /**
   * Header stats: per-template counts (invites, approvals, meeting
   * requests, …) and the recent bulk campaigns for the filter dropdown.
   * Declared before the list route so nesting is unambiguous.
   */
  @common.Get("stats")
  @swagger.ApiOkResponse({ type: AdminEmailsStatsResponseDto })
  async stats(
    @common.Req() request: Request
  ): Promise<AdminEmailsStatsResponseDto> {
    const query = plainToInstance(AdminEmailsListQueryDto, request.query, {
      enableImplicitConversion: true,
    });
    return this.service.stats(query);
  }

  /**
   * Full export of EVERY email matching the filters (no pagination) as CSV
   * or Excel (.xlsx). Same scope as the table: campaign beats the window;
   * status/template/recipient/audience filters apply; newest first; capped
   * at 20000 rows. format=csv|xlsx (default csv).
   */
  @common.Get("export")
  @swagger.ApiProduces("text/csv")
  @swagger.ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  @swagger.ApiOkResponse({ schema: { type: "string", format: "binary" } })
  async export(
    @common.Req() request: Request
  ): Promise<StreamableFile> {
    const query = plainToInstance(AdminEmailsListQueryDto, request.query, {
      enableImplicitConversion: true,
    });
    const format = request.query.format === "xlsx" ? "xlsx" : "csv";
    const { buffer, contentType, filename } = await this.service.exportEmails(
      query,
      format
    );
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="${filename}"`,
      length: buffer.length,
    });
  }

  @common.Get()
  @swagger.ApiOkResponse({ type: AdminEmailsListResponseDto })
  async list(
    @common.Req() request: Request
  ): Promise<AdminEmailsListResponseDto> {
    const query = plainToInstance(AdminEmailsListQueryDto, request.query, {
      enableImplicitConversion: true,
    });
    return this.service.list(query);
  }
}
