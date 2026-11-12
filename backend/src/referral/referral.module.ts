import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingModule } from "../appSetting/appSetting.module";
import { DriverPayoutModule } from "../driverPayout/driverPayout.module";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { MailService } from "../common/mail/mail.service";
import { ReferralController } from "./referral.controller";
import { ReferralPublicController } from "./referral.public.controller";
import { ReferralService } from "./referral.service";
import { ReferralTriggerService } from "./referral-trigger.service";
import { ReferralCreditApplicationService } from "./referral-credit-application.service";
import { ReferralExpiryScheduler } from "./referral-expiry.scheduler";

@Module({
  // DriverPayoutModule provides the REFERRAL_REWARD_PAYOUT_PROVIDER token.
  // We import it here so the referral module can inject the provider —
  // but the referral module's CODE only knows about the interface,
  // never the concrete ReferralPayoutProviderImpl class.
  imports: [forwardRef(() => AuthModule), AppSettingModule, DriverPayoutModule],
  controllers: [ReferralController, ReferralPublicController],
  // NotificationEventEngine + MailService are provided locally (the same
  // pattern delivery-logistics uses) so ReferralTriggerService can send the
  // "referral bonus earned" email when a payout is created ELIGIBLE.
  providers: [
    ReferralService,
    ReferralTriggerService,
    ReferralCreditApplicationService,
    ReferralExpiryScheduler,
    NotificationEventEngine,
    MailService,
  ],
  exports: [ReferralService, ReferralTriggerService, ReferralCreditApplicationService],
})
export class ReferralModule {}
