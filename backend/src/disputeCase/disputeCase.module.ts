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
import { MailModule } from "../common/mail/mail.module";

@Module({
  imports: [DisputeCaseModuleBase, forwardRef(() => AuthModule), MailModule],
  controllers: [DisputeCaseController],
  providers: [
    DisputeCaseService,
    DisputeCaseResolver,
    DisputeCaseDomain,
    DisputeCasePolicyService,
    DisputeAdminEngine,
    // DisputeAdminEngine injects NotificationEventEngine to send real
    // dispute notifications (queueAndSend) instead of raw prisma rows.
    // MailModule (imported above) supplies the shared MailService the
    // engine injects. A locally-registered MailService would crash DI:
    // MailService now requires AdminGateService, and a local provider
    // cannot see AdminGateModule from this context.
    NotificationEventEngine,
  ],
  exports: [DisputeCaseService],
})
export class DisputeCaseModule {}
