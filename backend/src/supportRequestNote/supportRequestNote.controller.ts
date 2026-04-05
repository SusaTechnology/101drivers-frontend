import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { SupportRequestNoteService } from "./supportRequestNote.service";
import { SupportRequestNoteControllerBase } from "./base/supportRequestNote.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { SupportRequestNoteCreateInput } from "./base/SupportRequestNoteCreateInput";
import { SupportRequestNote } from "./base/SupportRequestNote";
import { SupportRequestNoteFindManyArgs } from "./base/SupportRequestNoteFindManyArgs";
import { SupportRequestNoteWhereUniqueInput } from "./base/SupportRequestNoteWhereUniqueInput";
import { SupportRequestNoteUpdateInput } from "./base/SupportRequestNoteUpdateInput";
@swagger.ApiTags("supportRequestNotes")
@common.Controller("supportRequestNotes")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class SupportRequestNoteController extends SupportRequestNoteControllerBase {
  constructor(
    protected readonly service: SupportRequestNoteService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: SupportRequestNote })
  @nestAccessControl.UseRoles({
    resource: "SupportRequestNote",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createSupportRequestNote(
    @common.Body() data: SupportRequestNoteCreateInput
  ): Promise<SupportRequestNote> {
    return await this.service.createSupportRequestNote({
      data: {
        ...data,

        authorUser: data.authorUser
          ? {
              connect: data.authorUser,
            }
          : undefined,

        supportRequest: {
          connect: data.supportRequest,
        },
      },
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
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [SupportRequestNote] })
  @ApiNestedQuery(SupportRequestNoteFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "SupportRequestNote",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async supportRequestNotes(
    @common.Req() request: Request
  ): Promise<SupportRequestNote[]> {
    const args = plainToClass(SupportRequestNoteFindManyArgs, request.query);
    return this.service.supportRequestNotes({
      ...args,
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
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: SupportRequestNote })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "SupportRequestNote",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async supportRequestNote(
    @common.Param() params: SupportRequestNoteWhereUniqueInput
  ): Promise<SupportRequestNote | null> {
    const result = await this.service.supportRequestNote({
      where: params,
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
    if (result === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return result;
  }

  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: SupportRequestNote })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "SupportRequestNote",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateSupportRequestNote(
    @common.Param() params: SupportRequestNoteWhereUniqueInput,
    @common.Body() data: SupportRequestNoteUpdateInput
  ): Promise<SupportRequestNote | null> {
    try {
      return await this.service.updateSupportRequestNote({
        where: params,
        data: {
          ...data,

          authorUser: data.authorUser
            ? {
                connect: data.authorUser,
              }
            : undefined,

          supportRequest: {
            connect: data.supportRequest,
          },
        },
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
  @swagger.ApiOkResponse({ type: SupportRequestNote })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "SupportRequestNote",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteSupportRequestNote(
    @common.Param() params: SupportRequestNoteWhereUniqueInput
  ): Promise<SupportRequestNote | null> {
    try {
      return await this.service.deleteSupportRequestNote({
        where: params,
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

