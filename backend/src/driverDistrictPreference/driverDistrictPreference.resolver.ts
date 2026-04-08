import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DriverDistrictPreferenceResolverBase } from "./base/driverDistrictPreference.resolver.base";
import { DriverDistrictPreference } from "./base/DriverDistrictPreference";
import { DriverDistrictPreferenceService } from "./driverDistrictPreference.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DriverDistrictPreference)
export class DriverDistrictPreferenceResolver extends DriverDistrictPreferenceResolverBase {
  constructor(
    protected readonly service: DriverDistrictPreferenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
