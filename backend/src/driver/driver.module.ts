import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverModuleBase } from "./base/driver.module.base";
import { DriverService } from "./driver.service";
import { DriverController } from "./driver.controller";
import { DriverOnboardingController } from "./driverOnboarding.controller";
import { DriverOnboardingPublicController } from "./driverOnboardingPublic.controller";
import { DriverResolver } from "./driver.resolver";
import { DriverPolicyService } from "src/domain/driver/driverPolicy.service";
import { DriverDomain } from "src/domain/driver/driver.domain";
import { DriverApprovalEngine } from "src/domain/driver/driverApproval.engine";
import { NotificationEventEngine } from "src/domain/notificationEvent/notificationEvent.engine";
import { MailService } from "src/common/mail/mail.service";
import { ReferralModule } from "../referral/referral.module";

@Module({
  // ReferralModule provides ReferralTriggerService — needed by
  // DriverApprovalEngine to fire the ON_APPROVED trigger when admin
  // approves a referred driver. forwardRef to break the circular
  // dependency chain.
  imports: [
    DriverModuleBase,
    forwardRef(() => AuthModule),
    forwardRef(() => ReferralModule),
  ],
  controllers: [DriverController, DriverOnboardingController, DriverOnboardingPublicController],
  providers: [DriverService, DriverResolver, DriverDomain, DriverPolicyService, DriverApprovalEngine, NotificationEventEngine, MailService],
  exports: [DriverService],
})
export class DriverModule {}
