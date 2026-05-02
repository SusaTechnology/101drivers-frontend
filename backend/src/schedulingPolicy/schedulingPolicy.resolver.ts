import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { SchedulingPolicyResolverBase } from "./base/schedulingPolicy.resolver.base";
import { SchedulingPolicy } from "./base/SchedulingPolicy";
import { SchedulingPolicyService } from "./schedulingPolicy.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => SchedulingPolicy)
export class SchedulingPolicyResolver extends SchedulingPolicyResolverBase {
  constructor(
    protected readonly service: SchedulingPolicyService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
