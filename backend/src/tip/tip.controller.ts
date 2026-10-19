import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Request } from "express";
import { TipService } from "./tip.service";
import { TipControllerBase } from "./base/tip.controller.base";
import { TipWhereUniqueInput } from "./base/TipWhereUniqueInput";
import { TipUpdateInput } from "./base/TipUpdateInput";
import { Tip } from "./base/Tip";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { PrismaService } from "../prisma/prisma.service";
import * as errors from "../errors";
import { isRecordNotFoundError } from "../prisma.util";

@swagger.ApiTags("tips")
@common.Controller("tips")
export class TipController extends TipControllerBase {
  constructor(
    protected readonly service: TipService,
    private readonly prisma: PrismaService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  // ── Session-aware access helpers (authorization hardening) ────────
  private isAdminRequest(request: Request): boolean {
    const user = (request as any).user ?? null;
    return Array.isArray(user?.roles) && user.roles.includes("ADMIN");
  }

  private async resolveSessionCustomerId(request: Request): Promise<string | null> {
    const user = (request as any).user ?? null;
    if (!user?.id) return null;
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return customer?.id ?? null;
  }

  /**
   * GET /tips — ROW-LEVEL SCOPING. Non-admin callers only see tips that
   * belong to their OWN deliveries. Implemented by merging an owner
   * filter into the request query before the base handler parses it,
   * so the base select/shape stays the single source of truth.
   */
  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  async tips(@common.Req() request: Request): Promise<Tip[]> {
    if (!this.isAdminRequest(request)) {
      const sessionCustomerId = await this.resolveSessionCustomerId(request);
      const ownerWhere = sessionCustomerId
        ? { delivery: { customerId: sessionCustomerId } }
        : { id: { in: [] } }; // no customer profile → nothing

      // Express parses `where[delivery][id]=...` into a nested OBJECT
      // (deepObject style) — merge as objects, never stringify.
      let parsedWhere: any = {};
      const rawWhere = (request.query as any)?.where;
      if (rawWhere && typeof rawWhere === "object") {
        parsedWhere = rawWhere;
      }
      (request.query as any).where = {
        AND: [parsedWhere, ownerWhere],
      };
    }
    return super.tips(request);
  }

  /**
   * GET /tips/:id — same ownership rule for the single-tip read.
   */
  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  async tip(
    @common.Param() params: TipWhereUniqueInput,
    @common.Req() request?: Request
  ): Promise<Tip | null> {
    if (request && !this.isAdminRequest(request)) {
      const row = await this.prisma.tip.findUnique({
        where: { id: params.id },
        select: { delivery: { select: { customerId: true } } },
      });
      const sessionCustomerId = await this.resolveSessionCustomerId(request);
      if (
        !row ||
        !sessionCustomerId ||
        row.delivery?.customerId !== sessionCustomerId
      ) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
    }
    return super.tip(params);
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
    @common.Body() data: TipUpdateInput,
    @common.Req() request?: Request
  ): Promise<Tip | null> {
    // Ownership gate: only the tip's delivery owner (or an admin) may
    // update a tip (e.g. mark CAPTURED after the payment dialog).
    // (`request` optional for base-signature compatibility; always
    // injected at runtime.)
    if (request && !this.isAdminRequest(request)) {
      const row = await this.prisma.tip.findUnique({
        where: { id: params.id },
        select: { delivery: { select: { customerId: true } } },
      });
      const sessionCustomerId = await this.resolveSessionCustomerId(request);
      if (
        !row ||
        !sessionCustomerId ||
        row.delivery?.customerId !== sessionCustomerId
      ) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
    }
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
