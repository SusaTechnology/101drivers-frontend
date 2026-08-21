import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingModule } from "../appSetting/appSetting.module";
import { DriverPayoutModule } from "../driverPayout/driverPayout.module";
import { ReferralController } from "./referral.controller";
import { ReferralService } from "./referral.service";
import { ReferralTriggerService } from "./referral-trigger.service";
import { ReferralExpiryScheduler } from "./referral-expiry.scheduler";

@Module({
  // DriverPayoutModule provides the REFERRAL_REWARD_PAYOUT_PROVIDER token.
  // We import it here so the referral module can inject the provider —
  // but the referral module's CODE only knows about the interface,
  // never the concrete ReferralPayoutProviderImpl class.
  imports: [forwardRef(() => AuthModule), AppSettingModule, DriverPayoutModule],
  controllers: [ReferralController],
  providers: [ReferralService, ReferralTriggerService, ReferralExpiryScheduler],
  exports: [ReferralService, ReferralTriggerService],
})
export class ReferralModule {}
