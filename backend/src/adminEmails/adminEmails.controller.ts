import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { Request } from "express";
import { AdminEmailsService } from "./adminEmails.service";
import { AdminEmailsListQueryDto, AdminEmailsListResponseDto } from "./dto/adminEmails.dto";
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
