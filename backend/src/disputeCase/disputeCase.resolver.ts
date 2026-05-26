import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DisputeCaseResolverBase } from "./base/disputeCase.resolver.base";
import { DisputeCase } from "./base/DisputeCase";
import { DisputeCaseService } from "./disputeCase.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DisputeCase)
export class DisputeCaseResolver extends DisputeCaseResolverBase {
  constructor(
    protected readonly service: DisputeCaseService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
