import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryEvidenceService } from "./deliveryEvidence.service";
import { DeliveryEvidenceControllerBase } from "./base/deliveryEvidence.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { DeliveryEvidenceCreateInput } from "./base/DeliveryEvidenceCreateInput";
import { DeliveryEvidence } from "./base/DeliveryEvidence";
import { DeliveryEvidenceFindManyArgs } from "./base/DeliveryEvidenceFindManyArgs";
import { DeliveryEvidenceWhereUniqueInput } from "./base/DeliveryEvidenceWhereUniqueInput";
import { DeliveryEvidenceUpdateInput } from "./base/DeliveryEvidenceUpdateInput";
@swagger.ApiTags("deliveryEvidences")
@common.Controller("deliveryEvidences")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DeliveryEvidenceController extends DeliveryEvidenceControllerBase {
  constructor(
    protected readonly service: DeliveryEvidenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: DeliveryEvidence })
  @nestAccessControl.UseRoles({
    resource: "DeliveryEvidence",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDeliveryEvidence(
    @common.Body() data: DeliveryEvidenceCreateInput
  ): Promise<DeliveryEvidence> {
    return await this.service.createDeliveryEvidence({
      data: {
        ...data,

        delivery: {
          connect: data.delivery,
        },
      },
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        imageUrl: true,
        phase: true,
        slotIndex: true,
        type: true,
        updatedAt: true,
        value: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [DeliveryEvidence] })
  @ApiNestedQuery(DeliveryEvidenceFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryEvidence",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deliveryEvidences(
    @common.Req() request: Request
  ): Promise<DeliveryEvidence[]> {
    const args = plainToClass(DeliveryEvidenceFindManyArgs, request.query);
    return this.service.deliveryEvidences({
      ...args,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        imageUrl: true,
        phase: true,
        slotIndex: true,
        type: true,
        updatedAt: true,
        value: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: DeliveryEvidence })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryEvidence",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deliveryEvidence(
    @common.Param() params: DeliveryEvidenceWhereUniqueInput
  ): Promise<DeliveryEvidence | null> {
    const result = await this.service.deliveryEvidence({
      where: params,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        imageUrl: true,
        phase: true,
        slotIndex: true,
        type: true,
        updatedAt: true,
        value: true,
      },
    });
    if (result === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return result;
  }

  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: DeliveryEvidence })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryEvidence",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDeliveryEvidence(
    @common.Param() params: DeliveryEvidenceWhereUniqueInput,
    @common.Body() data: DeliveryEvidenceUpdateInput
  ): Promise<DeliveryEvidence | null> {
    try {
      return await this.service.updateDeliveryEvidence({
        where: params,
        data: {
          ...data,

          delivery: {
            connect: data.delivery,
          },
        },
        select: {
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          imageUrl: true,
          phase: true,
          slotIndex: true,
          type: true,
          updatedAt: true,
          value: true,
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

  @common.Delete("/:id")
  @swagger.ApiOkResponse({ type: DeliveryEvidence })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryEvidence",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDeliveryEvidence(
    @common.Param() params: DeliveryEvidenceWhereUniqueInput
  ): Promise<DeliveryEvidence | null> {
    try {
      return await this.service.deleteDeliveryEvidence({
        where: params,
        select: {
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          imageUrl: true,
          phase: true,
          slotIndex: true,
          type: true,
          updatedAt: true,
          value: true,
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
