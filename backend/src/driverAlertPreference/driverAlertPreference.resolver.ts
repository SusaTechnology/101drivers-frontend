import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DriverAlertPreferenceResolverBase } from "./base/driverAlertPreference.resolver.base";
import { DriverAlertPreference } from "./base/DriverAlertPreference";
import { DriverAlertPreferenceService } from "./driverAlertPreference.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DriverAlertPreference)
export class DriverAlertPreferenceResolver extends DriverAlertPreferenceResolverBase {
  constructor(
    protected readonly service: DriverAlertPreferenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
