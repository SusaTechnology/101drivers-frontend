import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { AdminAuditLogResolverBase } from "./base/adminAuditLog.resolver.base";
import { AdminAuditLog } from "./base/AdminAuditLog";
import { AdminAuditLogService } from "./adminAuditLog.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => AdminAuditLog)
export class AdminAuditLogResolver extends AdminAuditLogResolverBase {
  constructor(
    protected readonly service: AdminAuditLogService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
