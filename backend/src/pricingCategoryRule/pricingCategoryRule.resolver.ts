import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { PricingCategoryRuleResolverBase } from "./base/pricingCategoryRule.resolver.base";
import { PricingCategoryRule } from "./base/PricingCategoryRule";
import { PricingCategoryRuleService } from "./pricingCategoryRule.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => PricingCategoryRule)
export class PricingCategoryRuleResolver extends PricingCategoryRuleResolverBase {
  constructor(
    protected readonly service: PricingCategoryRuleService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
