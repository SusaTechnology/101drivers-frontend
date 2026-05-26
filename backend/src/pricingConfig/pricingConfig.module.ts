import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingConfigModuleBase } from "./base/pricingConfig.module.base";
import { PricingConfigService } from "./pricingConfig.service";
import { PricingConfigController } from "./pricingConfig.controller";
import { PricingConfigResolver } from "./pricingConfig.resolver";
import { PricingConfigDomain } from "src/domain/pricingConfig/pricingConfig.domain";
import { PricingConfigPolicyService } from "src/domain/pricingConfig/pricingConfigPolicy.service";
import { PricingEngineService } from "src/delivery-logistics/pricing-engine.service";
import { PricingConfigAdminEngine } from "src/domain/pricingConfig/pricingConfigAdmin.engine";

@Module({
  imports: [PricingConfigModuleBase, forwardRef(() => AuthModule)],
  controllers: [PricingConfigController],
  providers: [
    PricingConfigService,
    PricingConfigResolver,
    PricingConfigDomain,
    PricingConfigPolicyService,
    PricingEngineService,
    PricingConfigAdminEngine,
  ],
  exports: [PricingConfigService],
})
export class PricingConfigModule {}
