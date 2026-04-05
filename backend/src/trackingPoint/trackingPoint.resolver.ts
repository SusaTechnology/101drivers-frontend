import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { TrackingPointResolverBase } from "./base/trackingPoint.resolver.base";
import { TrackingPoint } from "./base/TrackingPoint";
import { TrackingPointService } from "./trackingPoint.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => TrackingPoint)
export class TrackingPointResolver extends TrackingPointResolverBase {
  constructor(
    protected readonly service: TrackingPointService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
