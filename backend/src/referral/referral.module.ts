import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingModule } from "../appSetting/appSetting.module";
import { DriverPayoutModule } from "../driverPayout/driverPayout.module";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { MailModule } from "../common/mail/mail.module";
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
  imports: [forwardRef(() => AuthModule), AppSettingModule, DriverPayoutModule, MailModule],
  controllers: [ReferralController, ReferralPublicController],
  // NotificationEventEngine is provided locally; MailModule (imported
  // above) supplies the shared MailService so ReferralTriggerService can
  // send the "referral bonus earned" email when a payout is created
  // ELIGIBLE. (A locally-registered MailService would crash DI — MailService
  // requires AdminGateService, invisible from this context.)
  providers: [
    ReferralService,
    ReferralTriggerService,
    ReferralCreditApplicationService,
    ReferralExpiryScheduler,
    NotificationEventEngine,
  ],
  exports: [ReferralService, ReferralTriggerService, ReferralCreditApplicationService],
})
export class ReferralModule {}
