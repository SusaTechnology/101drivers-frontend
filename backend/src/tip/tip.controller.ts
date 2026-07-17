import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { TipService } from "./tip.service";
import { TipControllerBase } from "./base/tip.controller.base";
import { TipWhereUniqueInput } from "./base/TipWhereUniqueInput";
import { TipUpdateInput } from "./base/TipUpdateInput";
import { Tip } from "./base/Tip";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import * as errors from "../errors";
import { isRecordNotFoundError } from "../prisma.util";

@swagger.ApiTags("tips")
@common.Controller("tips")
export class TipController extends TipControllerBase {
  constructor(
    protected readonly service: TipService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  /**
   * Override the generated updateTip to avoid sending `delivery: { connect: undefined }`
   * when the caller PATCHes a partial body (e.g. { status: "CAPTURED" } from the
   * dealer tip flow). The generated base always spreads `delivery: { connect: data.delivery }`
   * which Prisma rejects when `data.delivery` is undefined, producing a
   * PrismaClientValidationError that the error handler then misclassifies as
   * "record not found" → 404.
   *
   * We only include `delivery: { connect }` when the caller actually passed a
   * delivery reference. Otherwise we forward the partial body as-is.
   */
  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: Tip })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Tip",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({ type: errors.ForbiddenException })
  async updateTip(
    @common.Param() params: TipWhereUniqueInput,
    @common.Body() data: TipUpdateInput
  ): Promise<Tip | null> {
    // Reuse the same service path the base would use, but only inject
    // `delivery.connect` when explicitly provided.
    const payload: any = { ...data };
    if (data.delivery) {
      payload.delivery = { connect: data.delivery };
    } else {
      delete payload.delivery;
    }

    try {
      return await this.service.updateTip({
        where: params,
        data: payload,
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
