import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingTierModuleBase } from "./base/pricingTier.module.base";
import { PricingTierService } from "./pricingTier.service";
import { PricingTierController } from "./pricingTier.controller";
import { PricingTierResolver } from "./pricingTier.resolver";
import { PricingTierPolicyService } from "src/domain/pricingTier/pricingTierPolicy.service";
import { PricingTierDomain } from "src/domain/pricingTier/pricingTier.domain";

@Module({
  imports: [PricingTierModuleBase, forwardRef(() => AuthModule)],
  controllers: [PricingTierController],
  providers: [PricingTierService, PricingTierResolver, PricingTierDomain, PricingTierPolicyService],
  exports: [PricingTierService],
})
export class PricingTierModule {}
