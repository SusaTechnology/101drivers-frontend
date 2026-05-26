import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DeliveryRatingResolverBase } from "./base/deliveryRating.resolver.base";
import { DeliveryRating } from "./base/DeliveryRating";
import { DeliveryRatingService } from "./deliveryRating.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DeliveryRating)
export class DeliveryRatingResolver extends DeliveryRatingResolverBase {
  constructor(
    protected readonly service: DeliveryRatingService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
