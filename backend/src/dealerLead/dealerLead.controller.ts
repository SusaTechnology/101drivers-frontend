// src/dealerLead/dealerLead.controller.ts

import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Request } from "express";
import { plainToClass } from "class-transformer";

import { DealerLeadService } from "./dealerLead.service";
import { DealerLeadControllerBase } from "./base/dealerLead.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";

import { DealerLead } from "./base/DealerLead";
import { DealerLeadFindManyArgs } from "./base/DealerLeadFindManyArgs";
import { DealerLeadWhereUniqueInput } from "./base/DealerLeadWhereUniqueInput";
import { DealerLeadUpdateInput } from "./base/DealerLeadUpdateInput";

@swagger.ApiTags("dealerLeads")
@common.Controller("dealerLeads")
export class DealerLeadController extends DealerLeadControllerBase {
  constructor(
    protected readonly service: DealerLeadService,
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
  @swagger.ApiOkResponse({ type: [DealerLead] })
  @ApiNestedQuery(DealerLeadFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DealerLead",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async adminDealerLeads(@common.Req() request: Request): Promise<DealerLead[]> {
    const args = plainToClass(DealerLeadFindManyArgs, request.query);

    return this.service.dealerLeads({
      ...args,
      orderBy: args.orderBy ?? { createdAt: "desc" },
      select: {
        businessName: true,
        createdAt: true,
        email: true,
        id: true,
        message: true,
        phone: true,
        updatedAt: true,
      },
    });
  }

  @swagger.ApiBearerAuth()
  @common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("admin/:id")
  @swagger.ApiOkResponse({ type: DealerLead })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DealerLead",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async adminDealerLead(
    @common.Param() params: DealerLeadWhereUniqueInput
  ): Promise<DealerLead | null> {
    const result = await this.service.dealerLead({
      where: params,
      select: {
        businessName: true,
        createdAt: true,
        email: true,
        id: true,
        message: true,
        phone: true,
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
  @swagger.ApiOkResponse({ type: DealerLead })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DealerLead",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDealerLead(
    @common.Param() params: DealerLeadWhereUniqueInput,
    @common.Body() data: DealerLeadUpdateInput
  ): Promise<DealerLead | null> {
    try {
      return await this.service.updateDealerLead({
        where: params,
        data,
        select: {
          businessName: true,
          createdAt: true,
          email: true,
          id: true,
          message: true,
          phone: true,
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
  @swagger.ApiOkResponse({ type: DealerLead })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DealerLead",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDealerLead(
    @common.Param() params: DealerLeadWhereUniqueInput
  ): Promise<DealerLead | null> {
    try {
      return await this.service.deleteDealerLead({
        where: params,
        select: {
          businessName: true,
          createdAt: true,
          email: true,
          id: true,
          message: true,
          phone: true,
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