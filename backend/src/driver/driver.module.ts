import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverModuleBase } from "./base/driver.module.base";
import { DriverService } from "./driver.service";
import { DriverController } from "./driver.controller";
import { DriverOnboardingController } from "./driverOnboarding.controller";
import { DriverResolver } from "./driver.resolver";
import { DriverPolicyService } from "src/domain/driver/driverPolicy.service";
import { DriverDomain } from "src/domain/driver/driver.domain";
import { DriverApprovalEngine } from "src/domain/driver/driverApproval.engine";
import { NotificationEventEngine } from "src/domain/notificationEvent/notificationEvent.engine";
import { MailService } from "src/common/mail/mail.service";

@Module({
  imports: [DriverModuleBase, forwardRef(() => AuthModule)],
  controllers: [DriverController, DriverOnboardingController],
  providers: [DriverService, DriverResolver, DriverDomain, DriverPolicyService, DriverApprovalEngine, NotificationEventEngine, MailService],
  exports: [DriverService],
})
export class DriverModule {}
