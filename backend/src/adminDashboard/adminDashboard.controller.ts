import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { plainToInstance } from "class-transformer";
import { AdminDashboardService } from "./adminDashboard.service";
import {
  AdminDashboardOverviewQuery,
  AdminDashboardOverviewResponseDto,
} from "./dto/adminDashboard.dto";
import { Request } from "express";

@swagger.ApiTags("adminDashboard")
@common.Controller("adminDashboard")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @common.Get("overview")
  @swagger.ApiOkResponse({
    type: AdminDashboardOverviewResponseDto,
  })
  async getOverview(
    @common.Req() request: Request
  ): Promise<AdminDashboardOverviewResponseDto> {
    const query = plainToInstance(AdminDashboardOverviewQuery, request.query);
    return this.service.getOverview(query);
  }
}