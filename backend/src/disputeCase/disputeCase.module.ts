import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DisputeCaseModuleBase } from "./base/disputeCase.module.base";
import { DisputeCaseService } from "./disputeCase.service";
import { DisputeCaseController } from "./disputeCase.controller";
import { DisputeCaseResolver } from "./disputeCase.resolver";
import { DisputeCaseDomain } from "src/domain/disputeCase/disputeCase.domain";
import { DisputeCasePolicyService } from "src/domain/disputeCase/disputeCasePolicy.service";
import { DisputeAdminEngine } from "../domain/disputeCase/disputeAdmin.engine";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { MailService } from "../common/mail/mail.service";

@Module({
  imports: [DisputeCaseModuleBase, forwardRef(() => AuthModule)],
  controllers: [DisputeCaseController],
  providers: [
    DisputeCaseService,
    DisputeCaseResolver,
    DisputeCaseDomain,
    DisputeCasePolicyService,
    DisputeAdminEngine,
    // DisputeAdminEngine injects NotificationEventEngine to send real
    // dispute notifications (queueAndSend) instead of raw prisma rows.
    // MailService is the engine's own dependency — both are registered
    // locally, matching the CustomerModule / DriverModule / SupportRequestModule
    // pattern (PrismaModule & StripeModule are @Global so those resolve).
    NotificationEventEngine,
    MailService,
  ],
  exports: [DisputeCaseService],
})
export class DisputeCaseModule {}
