import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { SupportRequestResolverBase } from "./base/supportRequest.resolver.base";
import { SupportRequest } from "./base/SupportRequest";
import { SupportRequestService } from "./supportRequest.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => SupportRequest)
export class SupportRequestResolver extends SupportRequestResolverBase {
  constructor(
    protected readonly service: SupportRequestService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
