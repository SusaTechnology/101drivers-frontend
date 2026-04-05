import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { TrackingSessionResolverBase } from "./base/trackingSession.resolver.base";
import { TrackingSession } from "./base/TrackingSession";
import { TrackingSessionService } from "./trackingSession.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => TrackingSession)
export class TrackingSessionResolver extends TrackingSessionResolverBase {
  constructor(
    protected readonly service: TrackingSessionService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
