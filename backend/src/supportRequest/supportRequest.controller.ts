import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { SupportRequestService } from "./supportRequest.service";
import { SupportRequestControllerBase } from "./base/supportRequest.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { EnumSupportActorRole } from "@prisma/client";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as nestAccessControl from "nest-access-control";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { SupportRequestCreateInput } from "./base/SupportRequestCreateInput";
import { SupportRequest } from "./base/SupportRequest";
import { SupportRequestFindManyArgs } from "./base/SupportRequestFindManyArgs";
import { SupportRequestWhereUniqueInput } from "./base/SupportRequestWhereUniqueInput";
import { SupportRequestUpdateInput } from "./base/SupportRequestUpdateInput";
import { SupportRequestNoteFindManyArgs } from "../supportRequestNote/base/SupportRequestNoteFindManyArgs";
import { SupportRequestNote } from "../supportRequestNote/base/SupportRequestNote";
import { SupportRequestNoteWhereUniqueInput } from "../supportRequestNote/base/SupportRequestNoteWhereUniqueInput";
import { AddInternalSupportNoteBody, AdminSupportRequestListQueryDto, AssignSupportRequestBody, ChangeSupportRequestStatusBody, CreateSupportRequestBody, MySupportRequestListQueryDto, ReplySupportRequestBody, SupportRequestListResponseDto } from "./dto/supportRequest.dto";

@swagger.ApiTags("supportRequests")
@common.Controller("supportRequests")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class SupportRequestController extends SupportRequestControllerBase {
  constructor(
    protected readonly service: SupportRequestService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  /**
   * Derive the acting role from the AUTHENTICATED user, not from the body.
   * The FE contract (src/types/support.ts) documents actorRole as optional:
   * "backend determines from auth token" — but the old DTO REQUIRED it, so
   * every caller that followed the contract (e.g. the driver issue report
   * page) was rejected with "actorRole must be one of the following
   * values". A client-supplied role is also a spoofable claim (a driver
   * could raise a ticket as ADMIN), so the body value is only kept as a
   * backward-compatible override for callers that already send it.
   *
   * Precedence when a user holds several roles: the operational hat that
   * most plausibly raised the ticket wins (DRIVER > BUSINESS_CUSTOMER >
   * PRIVATE_CUSTOMER > ADMIN); an unmatched role set falls back to
   * PRIVATE_CUSTOMER.
   */
  private deriveActorRole(user: any): EnumSupportActorRole {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (roles.includes("DRIVER")) return EnumSupportActorRole.DRIVER;
    if (roles.includes("BUSINESS_CUSTOMER")) return EnumSupportActorRole.DEALER;
    if (roles.includes("PRIVATE_CUSTOMER")) return EnumSupportActorRole.PRIVATE_CUSTOMER;
    if (roles.includes("ADMIN")) return EnumSupportActorRole.ADMIN;
    return EnumSupportActorRole.PRIVATE_CUSTOMER;
  }
  @common.Post("contact")
  @swagger.ApiCreatedResponse({ type: SupportRequest })
 
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createContactRequest(
    @common.Body() body: CreateSupportRequestBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.createContactRequest({
      actorUserId: user?.id ?? null,
      actorRole: body.actorRole ?? this.deriveActorRole(user),
      deliveryId: body.deliveryId ?? null,
      category: body.category,
      priority: body.priority ?? undefined,
      subject: body.subject ?? null,
      message: body.message,
    });
  }

  @common.Get("my")
  @swagger.ApiOkResponse({ type: SupportRequestListResponseDto })

  async mySupportRequests(
    @common.Query() query: MySupportRequestListQueryDto,
    @common.Req() req: Request
  ): Promise<SupportRequestListResponseDto> {
    const user = req.user as any;

    return this.service.getMySupportRequests({
      actorUserId: user?.id,
      status: query.status ?? null,
      category: query.category ?? null,
      priority: query.priority ?? null,
      take: query.take ?? 50,
      skip: query.skip ?? 0,
    });
  }

  @common.Get("admin")
  @swagger.ApiOkResponse({ type: SupportRequestListResponseDto })

  async adminSupportRequests(
    @common.Query() query: AdminSupportRequestListQueryDto
  ): Promise<SupportRequestListResponseDto> {
    return this.service.getAdminSupportRequests({
      status: query.status ?? null,
      category: query.category ?? null,
      priority: query.priority ?? null,
      actorRole: query.actorRole ?? null,
      assignedToUserId: query.assignedToUserId ?? null,
      deliveryId: query.deliveryId ?? null,
      take: query.take ?? 50,
      skip: query.skip ?? 0,
    });
  }

  @common.Get(":id/detail")
  @swagger.ApiOkResponse({ type: SupportRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })

  async supportRequestDetail(
    @common.Param("id") id: string,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;
    return this.service.getSupportRequestDetail({
      supportRequestId: id,
      actorUserId: user?.id ?? null,
      actorRoles: user?.roles ?? [],
    });
  }

  @common.Post(":id/reply")
  @swagger.ApiCreatedResponse({ type: Object })

  async replyToSupportRequest(
    @common.Param("id") id: string,
    @common.Body() body: ReplySupportRequestBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.replyToSupportRequest({
      supportRequestId: id,
      actorUserId: user?.id ?? null,
      actorRoles: user?.roles ?? [],
      message: body.message,
    });
  }

  @common.Post(":id/internal-note")
  @swagger.ApiCreatedResponse({ type: Object })

  async addInternalSupportNote(
    @common.Param("id") id: string,
    @common.Body() body: AddInternalSupportNoteBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.addInternalSupportNote({
      supportRequestId: id,
      actorUserId: user?.id ?? null,
      actorRoles: user?.roles ?? [],
      message: body.message,
    });
  }

  @common.Post(":id/assign")
  @swagger.ApiOkResponse({ type: SupportRequest })

  async assignSupportRequest(
    @common.Param("id") id: string,
    @common.Body() body: AssignSupportRequestBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.assignSupportRequest({
      supportRequestId: id,
      actorUserId: user?.id ?? null,
      actorRoles: user?.roles ?? [],
      assignedToUserId: body.assignedToUserId,
    });
  }

  @common.Post(":id/status")
  @swagger.ApiOkResponse({ type: SupportRequest })

  async changeSupportRequestStatus(
    @common.Param("id") id: string,
    @common.Body() body: ChangeSupportRequestStatusBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.changeSupportRequestStatus({
      supportRequestId: id,
      actorUserId: user?.id ?? null,
      actorRoles: user?.roles ?? [],
      status: body.status,
    });
  }

  @common.Post()
  @swagger.ApiCreatedResponse({ type: SupportRequest })

  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createSupportRequest(
    @common.Body() data: SupportRequestCreateInput
  ): Promise<SupportRequest> {
    return await this.service.createSupportRequest({
      data: {
        ...data,

        assignedTo: data.assignedTo
          ? {
              connect: data.assignedTo,
            }
          : undefined,

        delivery: data.delivery
          ? {
              connect: data.delivery,
            }
          : undefined,

        user: data.user
          ? {
              connect: data.user,
            }
          : undefined,
      },
      select: {
        actorRole: true,
        actorType: true,

        assignedTo: {
          select: {
            id: true,
          },
        },

        category: true,
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        message: true,
        priority: true,
        resolvedAt: true,
        status: true,
        subject: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  @common.Get()
  @swagger.ApiOkResponse({ type: [SupportRequest] })
  @ApiNestedQuery(SupportRequestFindManyArgs)

  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async supportRequests(
    @common.Req() request: Request
  ): Promise<SupportRequest[]> {
    const args = plainToClass(SupportRequestFindManyArgs, request.query);
    return this.service.supportRequests({
      ...args,
      select: {
        actorRole: true,
        actorType: true,

        assignedTo: {
          select: {
            id: true,
          },
        },

        category: true,
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        message: true,
        priority: true,
        resolvedAt: true,
        status: true,
        subject: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: SupportRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })

  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async supportRequest(
    @common.Param() params: SupportRequestWhereUniqueInput
  ): Promise<SupportRequest | null> {
    const result = await this.service.supportRequest({
      where: params,
      select: {
        actorRole: true,
        actorType: true,

        assignedTo: {
          select: {
            id: true,
          },
        },

        category: true,
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        message: true,
        priority: true,
        resolvedAt: true,
        status: true,
        subject: true,
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

  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: SupportRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })

  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateSupportRequest(
    @common.Param() params: SupportRequestWhereUniqueInput,
    @common.Body() data: SupportRequestUpdateInput
  ): Promise<SupportRequest | null> {
    try {
      return await this.service.updateSupportRequest({
        where: params,
        data: {
          ...data,

          assignedTo: data.assignedTo
            ? {
                connect: data.assignedTo,
              }
            : undefined,

          delivery: data.delivery
            ? {
                connect: data.delivery,
              }
            : undefined,

          user: data.user
            ? {
                connect: data.user,
              }
            : undefined,
        },
        select: {
          actorRole: true,
          actorType: true,

          assignedTo: {
            select: {
              id: true,
            },
          },

          category: true,
          closedAt: true,
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          message: true,
          priority: true,
          resolvedAt: true,
          status: true,
          subject: true,
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
  @swagger.ApiOkResponse({ type: SupportRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })

  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteSupportRequest(
    @common.Param() params: SupportRequestWhereUniqueInput
  ): Promise<SupportRequest | null> {
    try {
      return await this.service.deleteSupportRequest({
        where: params,
        select: {
          actorRole: true,
          actorType: true,

          assignedTo: {
            select: {
              id: true,
            },
          },

          category: true,
          closedAt: true,
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          id: true,
          message: true,
          priority: true,
          resolvedAt: true,
          status: true,
          subject: true,
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

  @common.Get("/:id/notes")
  @ApiNestedQuery(SupportRequestNoteFindManyArgs)

  async findNotes(
    @common.Req() request: Request,
    @common.Param() params: SupportRequestWhereUniqueInput
  ): Promise<SupportRequestNote[]> {
    const query = plainToClass(SupportRequestNoteFindManyArgs, request.query);
    const results = await this.service.findNotes(params.id, {
      ...query,
      select: {
        authorRole: true,

        authorUser: {
          select: {
            id: true,
          },
        },

        createdAt: true,
        id: true,
        isInternal: true,
        message: true,

        supportRequest: {
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

  @common.Post("/:id/notes")

  async connectNotes(
    @common.Param() params: SupportRequestWhereUniqueInput,
    @common.Body() body: SupportRequestNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notes: {
        connect: body,
      },
    };
    await this.service.updateSupportRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/notes")

  async updateNotes(
    @common.Param() params: SupportRequestWhereUniqueInput,
    @common.Body() body: SupportRequestNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notes: {
        set: body,
      },
    };
    await this.service.updateSupportRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/notes")
  async disconnectNotes(
    @common.Param() params: SupportRequestWhereUniqueInput,
    @common.Body() body: SupportRequestNoteWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notes: {
        disconnect: body,
      },
    };
    await this.service.updateSupportRequest({
      where: params,
      data,
      select: { id: true },
    });
  }
}
