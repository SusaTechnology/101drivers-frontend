import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { UserService } from "./user.service";
import { UserControllerBase } from "./base/user.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { UserCreateInput } from "./base/UserCreateInput";
import { User } from "./base/User";
import { UserFindManyArgs } from "./base/UserFindManyArgs";
import { UserWhereUniqueInput } from "./base/UserWhereUniqueInput";
import { UserUpdateInput } from "./base/UserUpdateInput";
import { AdminAuditLogFindManyArgs } from "../adminAuditLog/base/AdminAuditLogFindManyArgs";
import { AdminAuditLog } from "../adminAuditLog/base/AdminAuditLog";
import { AdminAuditLogWhereUniqueInput } from "../adminAuditLog/base/AdminAuditLogWhereUniqueInput";
import { DeliveryAssignmentFindManyArgs } from "../deliveryAssignment/base/DeliveryAssignmentFindManyArgs";
import { DeliveryAssignment } from "../deliveryAssignment/base/DeliveryAssignment";
import { DeliveryAssignmentWhereUniqueInput } from "../deliveryAssignment/base/DeliveryAssignmentWhereUniqueInput";
import { DeliveryComplianceFindManyArgs } from "../deliveryCompliance/base/DeliveryComplianceFindManyArgs";
import { DeliveryCompliance } from "../deliveryCompliance/base/DeliveryCompliance";
import { DeliveryComplianceWhereUniqueInput } from "../deliveryCompliance/base/DeliveryComplianceWhereUniqueInput";
import { CustomerFindManyArgs } from "../customer/base/CustomerFindManyArgs";
import { Customer } from "../customer/base/Customer";
import { CustomerWhereUniqueInput } from "../customer/base/CustomerWhereUniqueInput";
import { DeliveryRequestFindManyArgs } from "../deliveryRequest/base/DeliveryRequestFindManyArgs";
import { DeliveryRequest } from "../deliveryRequest/base/DeliveryRequest";
import { DeliveryRequestWhereUniqueInput } from "../deliveryRequest/base/DeliveryRequestWhereUniqueInput";
import { DisputeNoteFindManyArgs } from "../disputeNote/base/DisputeNoteFindManyArgs";
import { DisputeNote } from "../disputeNote/base/DisputeNote";
import { DisputeNoteWhereUniqueInput } from "../disputeNote/base/DisputeNoteWhereUniqueInput";
import { DriverFindManyArgs } from "../driver/base/DriverFindManyArgs";
import { Driver } from "../driver/base/Driver";
import { DriverWhereUniqueInput } from "../driver/base/DriverWhereUniqueInput";
import { EvidenceExportFindManyArgs } from "../evidenceExport/base/EvidenceExportFindManyArgs";
import { EvidenceExport } from "../evidenceExport/base/EvidenceExport";
import { EvidenceExportWhereUniqueInput } from "../evidenceExport/base/EvidenceExportWhereUniqueInput";
import { NotificationEventFindManyArgs } from "../notificationEvent/base/NotificationEventFindManyArgs";
import { NotificationEvent } from "../notificationEvent/base/NotificationEvent";
import { NotificationEventWhereUniqueInput } from "../notificationEvent/base/NotificationEventWhereUniqueInput";
import { ScheduleChangeRequestFindManyArgs } from "../scheduleChangeRequest/base/ScheduleChangeRequestFindManyArgs";
import { ScheduleChangeRequest } from "../scheduleChangeRequest/base/ScheduleChangeRequest";
import { ScheduleChangeRequestWhereUniqueInput } from "../scheduleChangeRequest/base/ScheduleChangeRequestWhereUniqueInput";
import { DeliveryStatusHistoryFindManyArgs } from "../deliveryStatusHistory/base/DeliveryStatusHistoryFindManyArgs";
import { DeliveryStatusHistory } from "../deliveryStatusHistory/base/DeliveryStatusHistory";
import { DeliveryStatusHistoryWhereUniqueInput } from "../deliveryStatusHistory/base/DeliveryStatusHistoryWhereUniqueInput";
import {
  UserAdminActionDto,
  UserAdminApprovalActionDto,
  UserAdminCreateBodyDto,
  UserAdminListQueryDto,
  UserAdminUpdateBodyDto,
} from "./dto/userAdmin.dto";
@swagger.ApiTags("users")
@common.Controller("users")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class UserController extends UserControllerBase {
  constructor(
    protected readonly service: UserService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.Post("admin-create")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "create",
  possession: "any",
})
async adminCreateUser(
  @common.Body() body: UserAdminCreateBodyDto
): Promise<any> {
  return this.service.adminCreateUser(body);
}  


 @common.Get("/lookup/minimal")
@swagger.ApiOkResponse({
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string", nullable: true },
        email: { type: "string" },
        username: { type: "string" },
        roles: { type: "string" },
        isActive: { type: "boolean" },
      },
    },
  },
})
@nestAccessControl.UseRoles({
  resource: "User",
  action: "read",
  possession: "any",
})
async userLookupMinimal(): Promise<
  {
    id: string;
    name: string | null;
    email: string;
    username: string;
    roles: string;
    isActive: boolean;
  }[]
> {
  return this.service.userLookupList();
} 
 @common.Patch(":id/admin-update")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async adminUpdateUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminUpdateBodyDto
): Promise<any> {
  return this.service.adminUpdateUser({
    userId: id,
    ...body,
  });
} 
 @common.Post(":id/approve-customer")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async approveCustomerFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.approveCustomerFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    postpaidEnabled: body.postpaidEnabled === true,
    note: body.note ?? null,
  });
}

@common.Post(":id/reject-customer")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async rejectCustomerFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.rejectCustomerFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}

@common.Post(":id/suspend-customer")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async suspendCustomerFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.suspendCustomerFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? "Suspended by admin",
  });
}

@common.Post(":id/unsuspend-customer")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async unsuspendCustomerFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.unsuspendCustomerFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/approve-driver")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async approveDriverFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.approveDriverFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/reject-driver")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async rejectDriverFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.rejectDriverFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}

@common.Post(":id/suspend-driver")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async suspendDriverFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.suspendDriverFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? "Suspended by admin",
  });
}

@common.Post(":id/unsuspend-driver")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async unsuspendDriverFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.unsuspendDriverFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/invite-driver")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async inviteDriverFromUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminApprovalActionDto
): Promise<any> {
  return this.service.inviteDriverFromUser({
    userId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Get("admin")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "read",
  possession: "any",
})
async adminUsers(
  @common.Query() query: UserAdminListQueryDto
): Promise<any> {
  return this.service.getAdminUsers(query);
}

@common.Get("admin/summary")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "read",
  possession: "any",
})
async adminUsersSummary(): Promise<any> {
  return this.service.getAdminUsersSummary();
}

@common.Get(":id/admin-detail")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "read",
  possession: "any",
})
async adminUserDetail(
  @common.Param("id") id: string
): Promise<any> {
  return this.service.getAdminUserDetail(id);
}

@common.Post(":id/suspend")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async suspendUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminActionDto
): Promise<any> {
  return this.service.suspendUser({
    id,
    reason: body.reason ?? null,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post(":id/unsuspend")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "User",
  action: "update",
  possession: "any",
})
async unsuspendUser(
  @common.Param("id") id: string,
  @common.Body() body: UserAdminActionDto
): Promise<any> {
  return this.service.unsuspendUser({
    id,
    actorUserId: body.actorUserId ?? null,
  });
}
@common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: User })
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createUser(@common.Body() data: UserCreateInput): Promise<User> {
    return await this.service.createUser({
      data: {
        ...data,

        customer: data.customer
          ? {
              connect: data.customer,
            }
          : undefined,

        driver: data.driver
          ? {
              connect: data.driver,
            }
          : undefined,
      },
      select: {
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        disabledAt: true,
        disabledReason: true,

        driver: {
          select: {
            id: true,
          },
        },

        email: true,
        emailVerifiedAt: true,
        fullName: true,
        id: true,
        isActive: true,
        lastLoginAt: true,
        password: true,
        passwordHash: true,
        phone: true,
        roles: true,
        updatedAt: true,
        username: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [User] })
  @ApiNestedQuery(UserFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async users(@common.Req() request: Request): Promise<User[]> {
    const args = plainToClass(UserFindManyArgs, request.query);
    return this.service.users({
      ...args,
      select: {
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        disabledAt: true,
        disabledReason: true,

        driver: {
          select: {
            id: true,
          },
        },

        email: true,
        emailVerifiedAt: true,
        fullName: true,
        id: true,
        isActive: true,
        lastLoginAt: true,
        password: true,
        passwordHash: true,
        phone: true,
        roles: true,
        updatedAt: true,
        username: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: User })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async user(
    @common.Param() params: UserWhereUniqueInput
  ): Promise<User | null> {
    const result = await this.service.user({
      where: params,
      select: {
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        disabledAt: true,
        disabledReason: true,

        driver: {
          select: {
            id: true,
          },
        },

        email: true,
        emailVerifiedAt: true,
        fullName: true,
        id: true,
        isActive: true,
        lastLoginAt: true,
        password: true,
        passwordHash: true,
        phone: true,
        roles: true,
        updatedAt: true,
        username: true,
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
  @swagger.ApiOkResponse({ type: User })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateUser(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() data: UserUpdateInput
  ): Promise<User | null> {
    try {
      return await this.service.updateUser({
        where: params,
        data: {
          ...data,

          customer: data.customer
            ? {
                connect: data.customer,
              }
            : undefined,

          driver: data.driver
            ? {
                connect: data.driver,
              }
            : undefined,
        },
        select: {
          createdAt: true,

          customer: {
            select: {
              id: true,
            },
          },

          disabledAt: true,
          disabledReason: true,

          driver: {
            select: {
              id: true,
            },
          },

          email: true,
          emailVerifiedAt: true,
          fullName: true,
          id: true,
          isActive: true,
          lastLoginAt: true,
          password: true,
          passwordHash: true,
          phone: true,
          roles: true,
          updatedAt: true,
          username: true,
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
  @swagger.ApiOkResponse({ type: User })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteUser(
    @common.Param() params: UserWhereUniqueInput
  ): Promise<User | null> {
    try {
      return await this.service.deleteUser({
        where: params,
        select: {
          createdAt: true,

          customer: {
            select: {
              id: true,
            },
          },

          disabledAt: true,
          disabledReason: true,

          driver: {
            select: {
              id: true,
            },
          },

          email: true,
          emailVerifiedAt: true,
          fullName: true,
          id: true,
          isActive: true,
          lastLoginAt: true,
          password: true,
          passwordHash: true,
          phone: true,
          roles: true,
          updatedAt: true,
          username: true,
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
  @common.Get("/:id/adminActions")
  @ApiNestedQuery(AdminAuditLogFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "read",
    possession: "any",
  })
  async findAdminActions(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<AdminAuditLog[]> {
    const query = plainToClass(AdminAuditLogFindManyArgs, request.query);
    const results = await this.service.findAdminActions(params.id, {
      ...query,
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
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/adminActions")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectAdminActions(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      adminActions: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/adminActions")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateAdminActions(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      adminActions: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/adminActions")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectAdminActions(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      adminActions: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/assignmentsMade")
  @ApiNestedQuery(DeliveryAssignmentFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryAssignment",
    action: "read",
    possession: "any",
  })
  async findAssignmentsMade(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<DeliveryAssignment[]> {
    const query = plainToClass(DeliveryAssignmentFindManyArgs, request.query);
    const results = await this.service.findAssignmentsMade(params.id, {
      ...query,
      select: {
        assignedAt: true,

        assignedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,

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
        unassignedAt: true,
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

  @common.Post("/:id/assignmentsMade")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectAssignmentsMade(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignmentsMade: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/assignmentsMade")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateAssignmentsMade(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignmentsMade: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/assignmentsMade")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectAssignmentsMade(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignmentsMade: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/auditTargets")
  @ApiNestedQuery(AdminAuditLogFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "read",
    possession: "any",
  })
  async findAuditTargets(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<AdminAuditLog[]> {
    const query = plainToClass(AdminAuditLogFindManyArgs, request.query);
    const results = await this.service.findAuditTargets(params.id, {
      ...query,
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
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/auditTargets")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectAuditTargets(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      auditTargets: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/auditTargets")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateAuditTargets(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      auditTargets: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/auditTargets")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectAuditTargets(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      auditTargets: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/compliancesVerified")
  @ApiNestedQuery(DeliveryComplianceFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryCompliance",
    action: "read",
    possession: "any",
  })
  async findCompliancesVerified(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<DeliveryCompliance[]> {
    const query = plainToClass(DeliveryComplianceFindManyArgs, request.query);
    const results = await this.service.findCompliancesVerified(params.id, {
      ...query,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        dropoffCompletedAt: true,
        id: true,
        odometerEnd: true,
        odometerStart: true,
        pickupCompletedAt: true,
        updatedAt: true,

        verifiedBy: {
          select: {
            id: true,
          },
        },

        verifiedByAdminAt: true,
        vinConfirmed: true,
        vinVerificationCode: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/compliancesVerified")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectCompliancesVerified(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryComplianceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      compliancesVerified: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/compliancesVerified")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateCompliancesVerified(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryComplianceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      compliancesVerified: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/compliancesVerified")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectCompliancesVerified(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryComplianceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      compliancesVerified: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/customersApproved")
  @ApiNestedQuery(CustomerFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "Customer",
    action: "read",
    possession: "any",
  })
  async findCustomersApproved(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<Customer[]> {
    const query = plainToClass(CustomerFindManyArgs, request.query);
    const results = await this.service.findCustomersApproved(params.id, {
      ...query,
      select: {
        approvalStatus: true,
        approvedAt: true,

        approvedBy: {
          select: {
            id: true,
          },
        },

        businessAddress: true,
        businessName: true,
        businessPhone: true,
        businessPlaceId: true,
        businessWebsite: true,
        contactEmail: true,
        contactName: true,
        contactPhone: true,
        createdAt: true,
        customerType: true,

        defaultPickup: {
          select: {
            id: true,
          },
        },

        id: true,
        phone: true,
        postpaidEnabled: true,

        pricingConfig: {
          select: {
            id: true,
          },
        },

        pricingModeOverride: true,
        suspendedAt: true,
        suspensionReason: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/customersApproved")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectCustomersApproved(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: CustomerWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      customersApproved: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/customersApproved")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateCustomersApproved(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: CustomerWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      customersApproved: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/customersApproved")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectCustomersApproved(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: CustomerWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      customersApproved: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/deliveriesCreated")
  @ApiNestedQuery(DeliveryRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async findDeliveriesCreated(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<DeliveryRequest[]> {
    const query = plainToClass(DeliveryRequestFindManyArgs, request.query);
    const results = await this.service.findDeliveriesCreated(params.id, {
      ...query,
      select: {
        afterHours: true,
        bufferMinutes: true,

        compliance: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        createdByRole: true,

        customer: {
          select: {
            id: true,
          },
        },

        customerChose: true,

        dispute: {
          select: {
            id: true,
          },
        },

        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        dropoffWindowEnd: true,
        dropoffWindowStart: true,
        etaMinutes: true,
        id: true,
        isUrgent: true,
        licensePlate: true,

        payment: {
          select: {
            id: true,
          },
        },

        payout: {
          select: {
            id: true,
          },
        },

        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        pickupWindowEnd: true,
        pickupWindowStart: true,

        quote: {
          select: {
            id: true,
          },
        },

        rating: {
          select: {
            id: true,
          },
        },

        recipientEmail: true,
        recipientName: true,
        recipientPhone: true,
        requiresOpsConfirmation: true,

        resubmittedFrom: {
          select: {
            id: true,
          },
        },

        sameDayEligible: true,
        serviceType: true,
        status: true,

        tip: {
          select: {
            id: true,
          },
        },

        trackingSession: {
          select: {
            id: true,
          },
        },

        trackingShareExpiresAt: true,
        trackingShareToken: true,
        updatedAt: true,
        urgentBonusAmount: true,
        vehicleColor: true,
        vehicleMake: true,
        vehicleModel: true,
        vinVerificationCode: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/deliveriesCreated")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectDeliveriesCreated(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      deliveriesCreated: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/deliveriesCreated")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateDeliveriesCreated(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      deliveriesCreated: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/deliveriesCreated")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectDeliveriesCreated(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      deliveriesCreated: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/disputeNotesAuthored")
  @ApiNestedQuery(DisputeNoteFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DisputeNote",
    action: "read",
    possession: "any",
  })
  async findDisputeNotesAuthored(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<DisputeNote[]> {
    const query = plainToClass(DisputeNoteFindManyArgs, request.query);
    const results = await this.service.findDisputeNotesAuthored(params.id, {
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

  @common.Post("/:id/disputeNotesAuthored")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectDisputeNotesAuthored(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DisputeNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      disputeNotesAuthored: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/disputeNotesAuthored")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateDisputeNotesAuthored(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DisputeNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      disputeNotesAuthored: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/disputeNotesAuthored")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectDisputeNotesAuthored(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DisputeNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      disputeNotesAuthored: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/driversApproved")
  @ApiNestedQuery(DriverFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "any",
  })
  async findDriversApproved(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<Driver[]> {
    const query = plainToClass(DriverFindManyArgs, request.query);
    const results = await this.service.findDriversApproved(params.id, {
      ...query,
      select: {
        alerts: {
          select: {
            id: true,
          },
        },

        approvedAt: true,

        approvedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,
        id: true,
        phone: true,

        preferences: {
          select: {
            id: true,
          },
        },

        profilePhotoUrl: true,
        status: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/driversApproved")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectDriversApproved(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DriverWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      driversApproved: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/driversApproved")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateDriversApproved(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DriverWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      driversApproved: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/driversApproved")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectDriversApproved(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DriverWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      driversApproved: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/exportsCreated")
  @ApiNestedQuery(EvidenceExportFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "EvidenceExport",
    action: "read",
    possession: "any",
  })
  async findExportsCreated(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<EvidenceExport[]> {
    const query = plainToClass(EvidenceExportFindManyArgs, request.query);
    const results = await this.service.findExportsCreated(params.id, {
      ...query,
      select: {
        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        metaJson: true,
        updatedAt: true,
        url: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/exportsCreated")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectExportsCreated(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: EvidenceExportWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      exportsCreated: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/exportsCreated")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateExportsCreated(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: EvidenceExportWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      exportsCreated: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/exportsCreated")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectExportsCreated(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: EvidenceExportWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      exportsCreated: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/notifEvents")
  @ApiNestedQuery(NotificationEventFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "read",
    possession: "any",
  })
  async findNotifEvents(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<NotificationEvent[]> {
    const query = plainToClass(NotificationEventFindManyArgs, request.query);
    const results = await this.service.findNotifEvents(params.id, {
      ...query,
      select: {
        actor: {
          select: {
            id: true,
          },
        },

        body: true,
        channel: true,
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

        errorMessage: true,
        failedAt: true,
        id: true,
        payload: true,
        sentAt: true,
        status: true,
        subject: true,
        templateCode: true,
        toEmail: true,
        toPhone: true,
        type: true,
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

  @common.Post("/:id/notifEvents")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectNotifEvents(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifEvents: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/notifEvents")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateNotifEvents(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifEvents: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/notifEvents")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectNotifEvents(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifEvents: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/scheduleChangesDecided")
  @ApiNestedQuery(ScheduleChangeRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "read",
    possession: "any",
  })
  async findScheduleChangesDecided(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<ScheduleChangeRequest[]> {
    const query = plainToClass(
      ScheduleChangeRequestFindManyArgs,
      request.query
    );
    const results = await this.service.findScheduleChangesDecided(params.id, {
      ...query,
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
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/scheduleChangesDecided")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectScheduleChangesDecided(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChangesDecided: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/scheduleChangesDecided")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateScheduleChangesDecided(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChangesDecided: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/scheduleChangesDecided")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectScheduleChangesDecided(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChangesDecided: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/scheduleChangesRequested")
  @ApiNestedQuery(ScheduleChangeRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "read",
    possession: "any",
  })
  async findScheduleChangesRequested(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<ScheduleChangeRequest[]> {
    const query = plainToClass(
      ScheduleChangeRequestFindManyArgs,
      request.query
    );
    const results = await this.service.findScheduleChangesRequested(params.id, {
      ...query,
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
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/scheduleChangesRequested")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectScheduleChangesRequested(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChangesRequested: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/scheduleChangesRequested")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateScheduleChangesRequested(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChangesRequested: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/scheduleChangesRequested")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectScheduleChangesRequested(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChangesRequested: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/statusActions")
  @ApiNestedQuery(DeliveryStatusHistoryFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryStatusHistory",
    action: "read",
    possession: "any",
  })
  async findStatusActions(
    @common.Req() request: Request,
    @common.Param() params: UserWhereUniqueInput
  ): Promise<DeliveryStatusHistory[]> {
    const query = plainToClass(
      DeliveryStatusHistoryFindManyArgs,
      request.query
    );
    const results = await this.service.findStatusActions(params.id, {
      ...query,
      select: {
        actor: {
          select: {
            id: true,
          },
        },

        actorRole: true,
        actorType: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        fromStatus: true,
        id: true,
        note: true,
        toStatus: true,
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

  @common.Post("/:id/statusActions")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async connectStatusActions(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryStatusHistoryWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      statusActions: {
        connect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/statusActions")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async updateStatusActions(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryStatusHistoryWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      statusActions: {
        set: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/statusActions")
  @nestAccessControl.UseRoles({
    resource: "User",
    action: "update",
    possession: "any",
  })
  async disconnectStatusActions(
    @common.Param() params: UserWhereUniqueInput,
    @common.Body() body: DeliveryStatusHistoryWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      statusActions: {
        disconnect: body,
      },
    };
    await this.service.updateUser({
      where: params,
      data,
      select: { id: true },
    });
  }
}
