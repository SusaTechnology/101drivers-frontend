// src/investorLead/investorLead.controller.ts

import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Request } from "express";
import { plainToClass } from "class-transformer";

import { InvestorLeadService } from "./investorLead.service";
import { InvestorLeadControllerBase } from "./base/investorLead.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";

import { InvestorLead } from "./base/InvestorLead";
import { InvestorLeadFindManyArgs } from "./base/InvestorLeadFindManyArgs";
import { InvestorLeadWhereUniqueInput } from "./base/InvestorLeadWhereUniqueInput";
import { InvestorLeadUpdateInput } from "./base/InvestorLeadUpdateInput";

@swagger.ApiTags("investorLeads")
@common.Controller("investorLeads")
export class InvestorLeadController extends InvestorLeadControllerBase {
  constructor(
    protected readonly service: InvestorLeadService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  // --------------------------------------------------
  // ADMIN
  // --------------------------------------------------

  @swagger.ApiBearerAuth()
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("admin")
  @swagger.ApiOkResponse({ type: [InvestorLead] })
  @ApiNestedQuery(InvestorLeadFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "InvestorLead",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async adminInvestorLeads(
    @common.Req() request: Request
  ): Promise<InvestorLead[]> {
    const args = plainToClass(InvestorLeadFindManyArgs, request.query);

    return this.service.investorLeads({
      ...args,
      orderBy: args.orderBy ?? { createdAt: "desc" },
      select: {
        createdAt: true,
        email: true,
        id: true,
        message: true,
        name: true,
        updatedAt: true,
      },
    });
  }

  @swagger.ApiBearerAuth()
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("admin/:id")
  @swagger.ApiOkResponse({ type: InvestorLead })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "InvestorLead",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async adminInvestorLead(
    @common.Param() params: InvestorLeadWhereUniqueInput
  ): Promise<InvestorLead | null> {
    const result = await this.service.investorLead({
      where: params,
      select: {
        createdAt: true,
        email: true,
        id: true,
        message: true,
        name: true,
        updatedAt: true,
      },
    });

    if (!result) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }

    return result;
  }

  @swagger.ApiBearerAuth()
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("admin/:id")
  @swagger.ApiOkResponse({ type: InvestorLead })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "InvestorLead",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateInvestorLead(
    @common.Param() params: InvestorLeadWhereUniqueInput,
    @common.Body() data: InvestorLeadUpdateInput
  ): Promise<InvestorLead | null> {
    try {
      return await this.service.updateInvestorLead({
        where: params,
        data,
        select: {
          createdAt: true,
          email: true,
          id: true,
          message: true,
          name: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }

  @swagger.ApiBearerAuth()
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @common.Delete("admin/:id")
  @swagger.ApiOkResponse({ type: InvestorLead })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "InvestorLead",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteInvestorLead(
    @common.Param() params: InvestorLeadWhereUniqueInput
  ): Promise<InvestorLead | null> {
    try {
      return await this.service.deleteInvestorLead({
        where: params,
        select: {
          createdAt: true,
          email: true,
          id: true,
          message: true,
          name: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }
}