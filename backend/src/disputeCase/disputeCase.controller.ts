import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { DisputeCaseCreateInput } from "./base/DisputeCaseCreateInput";
import { DisputeCase } from "./base/DisputeCase";
import { DisputeCaseFindManyArgs } from "./base/DisputeCaseFindManyArgs";
import { DisputeCaseWhereUniqueInput } from "./base/DisputeCaseWhereUniqueInput";
import { DisputeCaseUpdateInput } from "./base/DisputeCaseUpdateInput";
import { DisputeNoteFindManyArgs } from "../disputeNote/base/DisputeNoteFindManyArgs";
import { DisputeNote } from "../disputeNote/base/DisputeNote";
import { DisputeNoteWhereUniqueInput } from "../disputeNote/base/DisputeNoteWhereUniqueInput";
import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DisputeCaseService } from "./disputeCase.service";
import { DisputeCaseControllerBase } from "./base/disputeCase.controller.base";

import {
  AddDisputeNoteBody,
  CloseDisputeBody,
  OpenDisputeBody,
  ResolveDisputeBody,
  ToggleLegalHoldBody,
  UpdateDisputeStatusBody,
} from "./dto/disputeAdmin.dto";
import { EnumDisputeCaseStatus } from "@prisma/client";

@swagger.ApiTags("disputeCases")
@common.Controller("disputeCases")
export class DisputeCaseController extends DisputeCaseControllerBase {
  constructor(
    protected readonly service: DisputeCaseService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.Get("/admin")
@swagger.ApiOkResponse({ type: [Object] })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "read",
  possession: "any",
})
async adminListDisputes(
  @common.Query("status") status?: EnumDisputeCaseStatus
): Promise<any[]> {
  return this.service.adminListDisputes({
    status,
  });
}

@common.Post("/admin/open")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "create",
  possession: "any",
})
async adminOpenDispute(
  @common.Body() body: OpenDisputeBody
): Promise<any> {
  return this.service.adminOpenDispute({
    deliveryId: body.deliveryId,
    reason: body.reason,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post("/:id/admin-note")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "update",
  possession: "any",
})
async adminAddDisputeNote(
  @common.Param("id") id: string,
  @common.Body() body: AddDisputeNoteBody
): Promise<any> {
  return this.service.adminAddNote({
    disputeId: id,
    note: body.note,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post("/:id/admin-status")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "update",
  possession: "any",
})
async adminUpdateDisputeStatus(
  @common.Param("id") id: string,
  @common.Body() body: UpdateDisputeStatusBody
): Promise<any> {
  return this.service.adminUpdateStatus({
    disputeId: id,
    status: body.status,
    note: body.note ?? null,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post("/:id/admin-resolve")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "update",
  possession: "any",
})
async adminResolveDispute(
  @common.Param("id") id: string,
  @common.Body() body: ResolveDisputeBody
): Promise<any> {
  return this.service.adminResolveDispute({
    disputeId: id,
    resolutionNote: body.resolutionNote ?? null,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post("/:id/admin-close")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "update",
  possession: "any",
})
async adminCloseDispute(
  @common.Param("id") id: string,
  @common.Body() body: CloseDisputeBody
): Promise<any> {
  return this.service.adminCloseDispute({
    disputeId: id,
    closingNote: body.closingNote ?? null,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post("/:id/admin-legal-hold")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DisputeCase",
  action: "update",
  possession: "any",
})
async adminToggleLegalHold(
  @common.Param("id") id: string,
  @common.Body() body: ToggleLegalHoldBody
): Promise<any> {
  return this.service.adminToggleLegalHold({
    disputeId: id,
    legalHold: body.legalHold,
    note: body.note ?? null,
    actorUserId: body.actorUserId ?? null,
  });
}
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: DisputeCase })
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDisputeCase(
    @common.Body() data: DisputeCaseCreateInput
  ): Promise<DisputeCase> {
    return await this.service.createDisputeCase({
      data: {
        ...data,

        delivery: {
          connect: data.delivery,
        },
      },
      select: {
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        legalHold: true,
        openedAt: true,
        reason: true,
        resolvedAt: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [DisputeCase] })
  @ApiNestedQuery(DisputeCaseFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async disputeCases(@common.Req() request: Request): Promise<DisputeCase[]> {
    const args = plainToClass(DisputeCaseFindManyArgs, request.query);
    return this.service.disputeCases({
      ...args,
      select: {
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        legalHold: true,
        openedAt: true,
        reason: true,
        resolvedAt: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: DisputeCase })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async disputeCase(
    @common.Param() params: DisputeCaseWhereUniqueInput
  ): Promise<DisputeCase | null> {
    const result = await this.service.disputeCase({
      where: params,
      select: {
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        legalHold: true,
        openedAt: true,
        reason: true,
        resolvedAt: true,
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
  @swagger.ApiOkResponse({ type: DisputeCase })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDisputeCase(
    @common.Param() params: DisputeCaseWhereUniqueInput,
    @common.Body() data: DisputeCaseUpdateInput
  ): Promise<DisputeCase | null> {
    try {
      return await this.service.updateDisputeCase({
        where: params,
        data: {
          ...data,

          delivery: {
            connect: data.delivery,
          },
        },
        select: {
          closedAt: true,
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          legalHold: true,
          openedAt: true,
          reason: true,
          resolvedAt: true,
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
  @swagger.ApiOkResponse({ type: DisputeCase })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDisputeCase(
    @common.Param() params: DisputeCaseWhereUniqueInput
  ): Promise<DisputeCase | null> {
    try {
      return await this.service.deleteDisputeCase({
        where: params,
        select: {
          closedAt: true,
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          legalHold: true,
          openedAt: true,
          reason: true,
          resolvedAt: true,
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

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/notes")
  @ApiNestedQuery(DisputeNoteFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DisputeNote",
    action: "read",
    possession: "any",
  })
  async findNotes(
    @common.Req() request: Request,
    @common.Param() params: DisputeCaseWhereUniqueInput
  ): Promise<DisputeNote[]> {
    const query = plainToClass(DisputeNoteFindManyArgs, request.query);
    const results = await this.service.findNotes(params.id, {
      ...query,
      select: {
        author: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        dispute: {
          select: {
            id: true,
          },
        },

        id: true,
        note: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/notes")
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "update",
    possession: "any",
  })
  async connectNotes(
    @common.Param() params: DisputeCaseWhereUniqueInput,
    @common.Body() body: DisputeNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notes: {
        connect: body,
      },
    };
    await this.service.updateDisputeCase({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/notes")
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "update",
    possession: "any",
  })
  async updateNotes(
    @common.Param() params: DisputeCaseWhereUniqueInput,
    @common.Body() body: DisputeNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notes: {
        set: body,
      },
    };
    await this.service.updateDisputeCase({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/notes")
  @nestAccessControl.UseRoles({
    resource: "DisputeCase",
    action: "update",
    possession: "any",
  })
  async disconnectNotes(
    @common.Param() params: DisputeCaseWhereUniqueInput,
    @common.Body() body: DisputeNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notes: {
        disconnect: body,
      },
    };
    await this.service.updateDisputeCase({
      where: params,
      data,
      select: { id: true },
    });
  }
}
