import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { NotificationEventService } from "./notificationEvent.service";
import { NotificationEventControllerBase } from "./base/notificationEvent.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { NotificationEventCreateInput } from "./base/NotificationEventCreateInput";
import { NotificationEvent } from "./base/NotificationEvent";
import { NotificationEventFindManyArgs } from "./base/NotificationEventFindManyArgs";
import { NotificationEventWhereUniqueInput } from "./base/NotificationEventWhereUniqueInput";
import { NotificationEventUpdateInput } from "./base/NotificationEventUpdateInput";
import {
  ArchiveNotificationBody,
  ClickNotificationBody,
  MarkNotificationReadBody,
  MyNotificationEventListQueryDto,
  NotificationEventListResponseDto,
  OpenNotificationBody,
} from "./dto/notificationEvent.dto";
@swagger.ApiTags("notificationEvents")
@common.Controller("notificationEvents")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class NotificationEventController extends NotificationEventControllerBase {
  constructor(
    protected readonly service: NotificationEventService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
   @common.Get("my/inbox")
  @swagger.ApiOkResponse({ type: NotificationEventListResponseDto })
  async myNotificationEvents(
    @common.Query() query: MyNotificationEventListQueryDto,
    @common.Req() req: Request
  ): Promise<NotificationEventListResponseDto> {
    const user = req.user as any;
    console.log ("user ", user)
    return this.service.getMyNotificationEvents({
      actorUserId: user?.id,
      unreadOnly: query.unreadOnly === true,
      includeArchived: query.includeArchived === true,
      take: query.take ?? 50,
      skip: query.skip ?? 0,
    });
  }

  @common.Post(":id/open")
  @swagger.ApiOkResponse({ type: NotificationEvent })
  async openNotificationEvent(
    @common.Param("id") id: string,
    @common.Body() body: OpenNotificationBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.openNotificationEvent({
      notificationEventId: id,
      actorUserId: user?.id,
      markRead: body.markRead !== false,
    });
  }

  @common.Post(":id/mark-read")
  @swagger.ApiOkResponse({ type: NotificationEvent })
  async markNotificationEventRead(
    @common.Param("id") id: string,
    @common.Body() body: MarkNotificationReadBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.markNotificationEventRead({
      notificationEventId: id,
      actorUserId: user?.id,
      read: body.read !== false,
    });
  }

  @common.Post("mark-all-read")
  @swagger.ApiOkResponse({ type: Object })
  async markAllNotificationEventsRead(
    @common.Req() req: Request
  ): Promise<{ updatedCount: number }> {
    const user = req.user as any;

    return this.service.markAllNotificationEventsRead({
      actorUserId: user?.id,
    });
  }

  @common.Post(":id/archive")
  @swagger.ApiOkResponse({ type: NotificationEvent })
  async archiveNotificationEvent(
    @common.Param("id") id: string,
    @common.Body() body: ArchiveNotificationBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.archiveNotificationEvent({
      notificationEventId: id,
      actorUserId: user?.id,
      archived: body.archived !== false,
    });
  }

  @common.Post(":id/click")
  @swagger.ApiOkResponse({ type: NotificationEvent })
  async clickNotificationEvent(
    @common.Param("id") id: string,
    @common.Body() _body: ClickNotificationBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    return this.service.clickNotificationEvent({
      notificationEventId: id,
      actorUserId: user?.id,
    });
  }

 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: NotificationEvent })
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createNotificationEvent(
    @common.Body() data: NotificationEventCreateInput
  ): Promise<NotificationEvent> {
    return await this.service.createNotificationEvent({
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
      },
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
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [NotificationEvent] })
  @ApiNestedQuery(NotificationEventFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async notificationEvents(
    @common.Req() request: Request
  ): Promise<NotificationEvent[]> {
    const args = plainToClass(NotificationEventFindManyArgs, request.query);
    return this.service.notificationEvents({
      ...args,
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
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: NotificationEvent })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async notificationEvent(
    @common.Param() params: NotificationEventWhereUniqueInput
  ): Promise<NotificationEvent | null> {
    const result = await this.service.notificationEvent({
      where: params,
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
    if (result === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return result;
  }

  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: NotificationEvent })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateNotificationEvent(
    @common.Param() params: NotificationEventWhereUniqueInput,
    @common.Body() data: NotificationEventUpdateInput
  ): Promise<NotificationEvent | null> {
    try {
      return await this.service.updateNotificationEvent({
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
        },
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
  @swagger.ApiOkResponse({ type: NotificationEvent })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteNotificationEvent(
    @common.Param() params: NotificationEventWhereUniqueInput
  ): Promise<NotificationEvent | null> {
    try {
      return await this.service.deleteNotificationEvent({
        where: params,
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

