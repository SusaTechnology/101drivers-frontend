import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { ScheduleChangeRequestService } from "./scheduleChangeRequest.service";
import { ScheduleChangeRequestControllerBase } from "./base/scheduleChangeRequest.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { ScheduleChangeRequestCreateInput } from "./base/ScheduleChangeRequestCreateInput";
import { ScheduleChangeRequest } from "./base/ScheduleChangeRequest";
import { ScheduleChangeRequestFindManyArgs } from "./base/ScheduleChangeRequestFindManyArgs";
import { ScheduleChangeRequestWhereUniqueInput } from "./base/ScheduleChangeRequestWhereUniqueInput";
import { ScheduleChangeRequestUpdateInput } from "./base/ScheduleChangeRequestUpdateInput";
import {
  ApproveScheduleChangeBody,
  CancelScheduleChangeBody,
  DeclineScheduleChangeBody,
  RequestScheduleChangeBody,
} from "./dto/scheduleChangeWorkflow.dto";

@swagger.ApiTags("scheduleChangeRequests")
@common.Controller("scheduleChangeRequests")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class ScheduleChangeRequestController extends ScheduleChangeRequestControllerBase {
  constructor(
    protected readonly service: ScheduleChangeRequestService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.UseInterceptors(AclValidateRequestInterceptor)
@common.Post("request")
@swagger.ApiOkResponse({ type: ScheduleChangeRequest })
@nestAccessControl.UseRoles({
  resource: "ScheduleChangeRequest",
  action: "create",
  possession: "any",
})
async requestScheduleChange(
  @common.Body() body: RequestScheduleChangeBody
): Promise<ScheduleChangeRequest> {
  return this.service.requestScheduleChange({
    deliveryId: body.deliveryId,
    requestedByUserId: body.requestedByUserId ?? null,
    requestedByRole: body.requestedByRole ?? null,
    proposedPickupWindowStart: body.proposedPickupWindowStart ?? null,
    proposedPickupWindowEnd: body.proposedPickupWindowEnd ?? null,
    proposedDropoffWindowStart: body.proposedDropoffWindowStart ?? null,
    proposedDropoffWindowEnd: body.proposedDropoffWindowEnd ?? null,
    reason: body.reason ?? null,
  });
}

@common.Post(":id/approve")
@swagger.ApiOkResponse({ type: ScheduleChangeRequest })
@nestAccessControl.UseRoles({
  resource: "ScheduleChangeRequest",
  action: "update",
  possession: "any",
})
async approveScheduleChange(
  @common.Param() params: ScheduleChangeRequestWhereUniqueInput,
  @common.Body() body: ApproveScheduleChangeBody
): Promise<ScheduleChangeRequest> {
  return this.service.approveScheduleChange({
    scheduleChangeRequestId: params.id,
    decidedByUserId: body.decidedByUserId,
    decisionNote: body.decisionNote ?? null,
  });
}

@common.Post(":id/decline")
@swagger.ApiOkResponse({ type: ScheduleChangeRequest })
@nestAccessControl.UseRoles({
  resource: "ScheduleChangeRequest",
  action: "update",
  possession: "any",
})
async declineScheduleChange(
  @common.Param() params: ScheduleChangeRequestWhereUniqueInput,
  @common.Body() body: DeclineScheduleChangeBody
): Promise<ScheduleChangeRequest> {
  return this.service.declineScheduleChange({
    scheduleChangeRequestId: params.id,
    decidedByUserId: body.decidedByUserId,
    decisionNote: body.decisionNote ?? null,
  });
}

@common.Post(":id/cancel")
@swagger.ApiOkResponse({ type: ScheduleChangeRequest })
@nestAccessControl.UseRoles({
  resource: "ScheduleChangeRequest",
  action: "update",
  possession: "any",
})
async cancelScheduleChange(
  @common.Param() params: ScheduleChangeRequestWhereUniqueInput,
  @common.Body() body: CancelScheduleChangeBody
): Promise<ScheduleChangeRequest> {
  return this.service.cancelScheduleChange({
    scheduleChangeRequestId: params.id,
    actorUserId: body.actorUserId ?? null,
    actorRole: body.actorRole ?? null,
    note: body.note ?? null,
  });
}
  @common.Post()
  @swagger.ApiCreatedResponse({ type: ScheduleChangeRequest })
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createScheduleChangeRequest(
    @common.Body() data: ScheduleChangeRequestCreateInput
  ): Promise<ScheduleChangeRequest> {
    return await this.service.createScheduleChangeRequest({
      data: {
        ...data,

        decidedBy: data.decidedBy
          ? {
              connect: data.decidedBy,
            }
          : undefined,

        delivery: {
          connect: data.delivery,
        },

        requestedBy: data.requestedBy
          ? {
              connect: data.requestedBy,
            }
          : undefined,
      },
      select: {
        createdAt: true,
        decidedAt: true,

        decidedBy: {
          select: {
            id: true,
          },
        },

        decisionNote: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        proposedDropoffWindowEnd: true,
        proposedDropoffWindowStart: true,
        proposedPickupWindowEnd: true,
        proposedPickupWindowStart: true,
        reason: true,

        requestedBy: {
          select: {
            id: true,
          },
        },

        requestedByRole: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [ScheduleChangeRequest] })
  @ApiNestedQuery(ScheduleChangeRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async scheduleChangeRequests(
    @common.Req() request: Request
  ): Promise<ScheduleChangeRequest[]> {
    const args = plainToClass(ScheduleChangeRequestFindManyArgs, request.query);
    return this.service.scheduleChangeRequests({
      ...args,
      select: {
        createdAt: true,
        decidedAt: true,

        decidedBy: {
          select: {
            id: true,
          },
        },

        decisionNote: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        proposedDropoffWindowEnd: true,
        proposedDropoffWindowStart: true,
        proposedPickupWindowEnd: true,
        proposedPickupWindowStart: true,
        reason: true,

        requestedBy: {
          select: {
            id: true,
          },
        },

        requestedByRole: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: ScheduleChangeRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async scheduleChangeRequest(
    @common.Param() params: ScheduleChangeRequestWhereUniqueInput
  ): Promise<ScheduleChangeRequest | null> {
    const result = await this.service.scheduleChangeRequest({
      where: params,
      select: {
        createdAt: true,
        decidedAt: true,

        decidedBy: {
          select: {
            id: true,
          },
        },

        decisionNote: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        proposedDropoffWindowEnd: true,
        proposedDropoffWindowStart: true,
        proposedPickupWindowEnd: true,
        proposedPickupWindowStart: true,
        reason: true,

        requestedBy: {
          select: {
            id: true,
          },
        },

        requestedByRole: true,
        status: true,
        updatedAt: true,
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
  @swagger.ApiOkResponse({ type: ScheduleChangeRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateScheduleChangeRequest(
    @common.Param() params: ScheduleChangeRequestWhereUniqueInput,
    @common.Body() data: ScheduleChangeRequestUpdateInput
  ): Promise<ScheduleChangeRequest | null> {
    try {
      return await this.service.updateScheduleChangeRequest({
        where: params,
        data: {
          ...data,

          decidedBy: data.decidedBy
            ? {
                connect: data.decidedBy,
              }
            : undefined,

          delivery: {
            connect: data.delivery,
          },

          requestedBy: data.requestedBy
            ? {
                connect: data.requestedBy,
              }
            : undefined,
        },
        select: {
          createdAt: true,
          decidedAt: true,

          decidedBy: {
            select: {
              id: true,
            },
          },

          decisionNote: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          proposedDropoffWindowEnd: true,
          proposedDropoffWindowStart: true,
          proposedPickupWindowEnd: true,
          proposedPickupWindowStart: true,
          reason: true,

          requestedBy: {
            select: {
              id: true,
            },
          },

          requestedByRole: true,
          status: true,
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

  @common.Delete("/:id")
  @swagger.ApiOkResponse({ type: ScheduleChangeRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteScheduleChangeRequest(
    @common.Param() params: ScheduleChangeRequestWhereUniqueInput
  ): Promise<ScheduleChangeRequest | null> {
    try {
      return await this.service.deleteScheduleChangeRequest({
        where: params,
        select: {
          createdAt: true,
          decidedAt: true,

          decidedBy: {
            select: {
              id: true,
            },
          },

          decisionNote: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          proposedDropoffWindowEnd: true,
          proposedDropoffWindowStart: true,
          proposedPickupWindowEnd: true,
          proposedPickupWindowStart: true,
          reason: true,

          requestedBy: {
            select: {
              id: true,
            },
          },

          requestedByRole: true,
          status: true,
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
