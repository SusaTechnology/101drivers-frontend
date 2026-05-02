import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingCategoryRuleModuleBase } from "./base/pricingCategoryRule.module.base";
import { PricingCategoryRuleService } from "./pricingCategoryRule.service";
import { PricingCategoryRuleController } from "./pricingCategoryRule.controller";
import { PricingCategoryRuleResolver } from "./pricingCategoryRule.resolver";
import { PricingCategoryRulePolicyService } from "src/domain/pricingCategoryRule/pricingCategoryRulePolicy.service";
import { PricingCategoryRuleDomain } from "src/domain/pricingCategoryRule/pricingCategoryRule.domain";

@Module({
  imports: [PricingCategoryRuleModuleBase, forwardRef(() => AuthModule)],
  controllers: [PricingCategoryRuleController],
  providers: [PricingCategoryRuleService, PricingCategoryRuleResolver, PricingCategoryRuleDomain, PricingCategoryRulePolicyService],
  exports: [PricingCategoryRuleService],
})
export class PricingCategoryRuleModule {}
