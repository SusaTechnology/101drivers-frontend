import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { OperatingHourResolverBase } from "./base/operatingHour.resolver.base";
import { OperatingHour } from "./base/OperatingHour";
import { OperatingHourService } from "./operatingHour.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => OperatingHour)
export class OperatingHourResolver extends OperatingHourResolverBase {
  constructor(
    protected readonly service: OperatingHourService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
