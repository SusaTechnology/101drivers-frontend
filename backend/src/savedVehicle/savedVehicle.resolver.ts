import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { SavedVehicleResolverBase } from "./base/savedVehicle.resolver.base";
import { SavedVehicle } from "./base/SavedVehicle";
import { SavedVehicleService } from "./savedVehicle.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => SavedVehicle)
export class SavedVehicleResolver extends SavedVehicleResolverBase {
  constructor(
    protected readonly service: SavedVehicleService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
