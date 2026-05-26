import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { PricingTierResolverBase } from "./base/pricingTier.resolver.base";
import { PricingTier } from "./base/PricingTier";
import { PricingTierService } from "./pricingTier.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => PricingTier)
export class PricingTierResolver extends PricingTierResolverBase {
  constructor(
    protected readonly service: PricingTierService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
