import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DriverPreferenceResolverBase } from "./base/driverPreference.resolver.base";
import { DriverPreference } from "./base/DriverPreference";
import { DriverPreferenceService } from "./driverPreference.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DriverPreference)
export class DriverPreferenceResolver extends DriverPreferenceResolverBase {
  constructor(
    protected readonly service: DriverPreferenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
