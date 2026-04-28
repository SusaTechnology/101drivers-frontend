import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { PricingConfigResolverBase } from "./base/pricingConfig.resolver.base";
import { PricingConfig } from "./base/PricingConfig";
import { PricingConfigService } from "./pricingConfig.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => PricingConfig)
export class PricingConfigResolver extends PricingConfigResolverBase {
  constructor(
    protected readonly service: PricingConfigService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
