import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DriverLocationResolverBase } from "./base/driverLocation.resolver.base";
import { DriverLocation } from "./base/DriverLocation";
import { DriverLocationService } from "./driverLocation.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DriverLocation)
export class DriverLocationResolver extends DriverLocationResolverBase {
  constructor(
    protected readonly service: DriverLocationService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
