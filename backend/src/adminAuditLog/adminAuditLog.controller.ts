import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { AdminAuditLogService } from "./adminAuditLog.service";
import { AdminAuditLogControllerBase } from "./base/adminAuditLog.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { AdminAuditLogCreateInput } from "./base/AdminAuditLogCreateInput";
import { AdminAuditLog } from "./base/AdminAuditLog";
import { AdminAuditLogFindManyArgs } from "./base/AdminAuditLogFindManyArgs";
import { AdminAuditLogWhereUniqueInput } from "./base/AdminAuditLogWhereUniqueInput";
import { AdminAuditLogUpdateInput } from "./base/AdminAuditLogUpdateInput";
import { AdminAuditLogSearchDto } from "./dto/adminAuditLogSearch.dto";
@swagger.ApiTags("adminAuditLogs")
@common.Controller("adminAuditLogs")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class AdminAuditLogController extends AdminAuditLogControllerBase {
  constructor(
    protected readonly service: AdminAuditLogService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
  @common.UseInterceptors(AclFilterResponseInterceptor)
@common.Post("/search")
@swagger.ApiOkResponse({ type: [AdminAuditLog] })
@nestAccessControl.UseRoles({
  resource: "AdminAuditLog",
  action: "read",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async searchAdminAuditLogs(
  @common.Body() body: AdminAuditLogSearchDto
): Promise<AdminAuditLog[]> {
  return this.service.searchAdminAuditLogs(body);
}

 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: AdminAuditLog })
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createAdminAuditLog(
    @common.Body() data: AdminAuditLogCreateInput
  ): Promise<AdminAuditLog> {
    return await this.service.createAdminAuditLog({
      data: {
        ...data,

        actor: data.actor
          ? {
              connect: data.actor,
            }
          : undefined,

        customer: data.customer
          ? {
              connect: data.customer,
            }
          : undefined,

        delivery: data.delivery
          ? {
              connect: data.delivery,
            }
          : undefined,

        driver: data.driver
          ? {
              connect: data.driver,
            }
          : undefined,

        user: data.user
          ? {
              connect: data.user,
            }
          : undefined,
      },
      select: {
        action: true,

        actor: {
          select: {
            id: true,
          },
        },

        actorType: true,
        afterJson: true,
        beforeJson: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [AdminAuditLog] })
  @ApiNestedQuery(AdminAuditLogFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async adminAuditLogs(
    @common.Req() request: Request
  ): Promise<AdminAuditLog[]> {
    const args = plainToClass(AdminAuditLogFindManyArgs, request.query);
    return this.service.adminAuditLogs({
      ...args,
      select: {
        action: true,

        actor: {
          select: {
            id: true,
          },
        },

        actorType: true,
        afterJson: true,
        beforeJson: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: AdminAuditLog })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async adminAuditLog(
    @common.Param() params: AdminAuditLogWhereUniqueInput
  ): Promise<AdminAuditLog | null> {
    const result = await this.service.adminAuditLog({
      where: params,
      select: {
        action: true,

        actor: {
          select: {
            id: true,
          },
        },

        actorType: true,
        afterJson: true,
        beforeJson: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
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
  @swagger.ApiOkResponse({ type: AdminAuditLog })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateAdminAuditLog(
    @common.Param() params: AdminAuditLogWhereUniqueInput,
    @common.Body() data: AdminAuditLogUpdateInput
  ): Promise<AdminAuditLog | null> {
    try {
      return await this.service.updateAdminAuditLog({
        where: params,
        data: {
          ...data,

          actor: data.actor
            ? {
                connect: data.actor,
              }
            : undefined,

          customer: data.customer
            ? {
                connect: data.customer,
              }
            : undefined,

          delivery: data.delivery
            ? {
                connect: data.delivery,
              }
            : undefined,

          driver: data.driver
            ? {
                connect: data.driver,
              }
            : undefined,

          user: data.user
            ? {
                connect: data.user,
              }
            : undefined,
        },
        select: {
          action: true,

          actor: {
            select: {
              id: true,
            },
          },

          actorType: true,
          afterJson: true,
          beforeJson: true,
          createdAt: true,

          customer: {
            select: {
              id: true,
            },
          },

          delivery: {
            select: {
              id: true,
            },
          },

          driver: {
            select: {
              id: true,
            },
          },

          id: true,
          reason: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
            },
          },
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
  @swagger.ApiOkResponse({ type: AdminAuditLog })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteAdminAuditLog(
    @common.Param() params: AdminAuditLogWhereUniqueInput
  ): Promise<AdminAuditLog | null> {
    try {
      return await this.service.deleteAdminAuditLog({
        where: params,
        select: {
          action: true,

          actor: {
            select: {
              id: true,
            },
          },

          actorType: true,
          afterJson: true,
          beforeJson: true,
          createdAt: true,

          customer: {
            select: {
              id: true,
            },
          },

          delivery: {
            select: {
              id: true,
            },
          },

          driver: {
            select: {
              id: true,
            },
          },

          id: true,
          reason: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
            },
          },
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
