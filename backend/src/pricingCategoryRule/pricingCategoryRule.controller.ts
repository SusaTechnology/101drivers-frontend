import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { PricingCategoryRuleService } from "./pricingCategoryRule.service";
import { PricingCategoryRuleControllerBase } from "./base/pricingCategoryRule.controller.base";

@swagger.ApiTags("pricingCategoryRules")
@common.Controller("pricingCategoryRules")
export class PricingCategoryRuleController extends PricingCategoryRuleControllerBase {
  constructor(
    protected readonly service: PricingCategoryRuleService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
