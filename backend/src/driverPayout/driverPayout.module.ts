import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverPayoutModuleBase } from "./base/driverPayout.module.base";
import { DriverPayoutService } from "./driverPayout.service";
import { DriverPayoutController } from "./driverPayout.controller";
import { DriverPayoutResolver } from "./driverPayout.resolver";
import { DriverPayoutDomain } from "src/domain/driverPayout/driverPayout.domain";
import { DriverPayoutPolicyService } from "src/domain/driverPayout/driverPayoutPolicy.service";
import { DeliveryLogisticsModule } from "src/delivery-logistics/delivery-logistics.module";
import { ReferralPayoutProviderImpl } from "./referral-payout-provider.impl";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "../referral/referral-payout-provider";

@Module({
  imports: [DriverPayoutModuleBase, forwardRef(() => AuthModule), DeliveryLogisticsModule],
  controllers: [DriverPayoutController],
  providers: [
    DriverPayoutService,
    DriverPayoutResolver,
    DriverPayoutDomain,
    DriverPayoutPolicyService,
    // Bind the decoupled ReferralRewardPayoutProvider interface to
    // the concrete implementation that lives in this module.
    // The referral module imports DriverPayoutModule to get access
    // to this provider — but the referral module's CODE only knows
    // about the interface, never this concrete class.
    {
      provide: REFERRAL_REWARD_PAYOUT_PROVIDER,
      useClass: ReferralPayoutProviderImpl,
    },
  ],
  exports: [
    DriverPayoutService,
    REFERRAL_REWARD_PAYOUT_PROVIDER,
  ],
})
export class DriverPayoutModule {}
