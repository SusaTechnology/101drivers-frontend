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
import { PrismaService } from "../prisma/prisma.service";
import { EnumDriverStatus, EnumUserRoles } from "@prisma/client";
@swagger.ApiTags("deliveryEvidences")
@common.Controller("deliveryEvidences")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DeliveryEvidenceController extends DeliveryEvidenceControllerBase {
  constructor(
    protected readonly service: DeliveryEvidenceService,
    private readonly prisma: PrismaService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  /**
   * Participant-or-admin gate for delivery-attached record creation.
   * Proof-of-delivery rows previously trusted the request body's
   * `delivery.connect` with no ownership check — any authenticated caller
   * could fabricate evidence on ANY delivery. The contract mirrors the
   * deliveryRequest controller: owning customer, currently-ASSIGNED
   * driver, or admin. For DRIVER actors the current Driver.status must
   * also be APPROVED (a suspended driver must not create records).
   */
  private async assertDeliveryParticipantOrAdmin(
    deliveryId: string,
    request?: Request
  ): Promise<void> {
    const user = (request as any).user;
    if (!user?.id) {
      throw new common.UnauthorizedException("Not authenticated");
    }
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    if (roles.includes(EnumUserRoles.ADMIN)) return;

    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        customerId: true,
        assignments: {
          where: { unassignedAt: null },
          select: { driverId: true },
        },
      },
    });
    if (!delivery) {
      throw new errors.NotFoundException(
        `No resource was found for delivery ${deliveryId}`
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (customer && delivery.customerId === customer.id) return;

    const driver = await this.prisma.driver.findFirst({
      where: { userId: user.id },
      select: { id: true, status: true },
    });
    if (driver && delivery.assignments.some((a) => a.driverId === driver.id)) {
      if (driver.status !== EnumDriverStatus.APPROVED) {
        throw new common.ForbiddenException(
          `Driver account is not approved (current status: ${driver.status})`
        );
      }
      return;
    }

    // 404 rather than 403 — do not reveal other customers' deliveries.
    throw new errors.NotFoundException(
      `No resource was found for delivery ${deliveryId}`
    );
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
    @common.Body() data: DeliveryEvidenceCreateInput,
    @common.Req() request?: Request
  ): Promise<DeliveryEvidence> {
    // Ownership: the delivery id comes from the body, so it must be
    // validated against the session before any row is written.
    const deliveryId = (data as any)?.delivery?.connect?.id;
    if (typeof deliveryId === "string" && deliveryId) {
      await this.assertDeliveryParticipantOrAdmin(deliveryId, request);
    }
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
