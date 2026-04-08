import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupportRequestModuleBase } from "./base/supportRequest.module.base";
import { SupportRequestService } from "./supportRequest.service";
import { SupportRequestController } from "./supportRequest.controller";
import { SupportRequestResolver } from "./supportRequest.resolver";
import { SupportRequestDomain } from "../domain/supportRequest/supportRequest.domain";
import { SupportRequestPolicyService } from "../domain/supportRequest/supportRequestPolicy.service";
import { SupportRequestOrchestratorService } from "../support-logistics/support-request-orchestrator.service";
import { NotificationEventEngine } from "src/domain/notificationEvent/notificationEvent.engine";
import { MailService } from "src/common/mail/mail.service";

@Module({
  imports: [SupportRequestModuleBase, forwardRef(() => AuthModule)],
  controllers: [SupportRequestController],
  providers: [
    SupportRequestService,
    SupportRequestResolver,
    SupportRequestDomain,
    SupportRequestPolicyService,
    SupportRequestOrchestratorService,
    NotificationEventEngine,
    MailService
  ],
  exports: [SupportRequestService],
})
export class SupportRequestModule {}