import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DriverPayoutResolverBase } from "./base/driverPayout.resolver.base";
import { DriverPayout } from "./base/DriverPayout";
import { DriverPayoutService } from "./driverPayout.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DriverPayout)
export class DriverPayoutResolver extends DriverPayoutResolverBase {
  constructor(
    protected readonly service: DriverPayoutService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
