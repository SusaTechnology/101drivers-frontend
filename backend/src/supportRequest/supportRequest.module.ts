import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GatewayModule } from "../gateways/gateway.module";
import { SupportRequestModuleBase } from "./base/supportRequest.module.base";
import { SupportRequestService } from "./supportRequest.service";
import { SupportRequestController } from "./supportRequest.controller";
import { SupportRequestResolver } from "./supportRequest.resolver";
import { SupportRequestDomain } from "../domain/supportRequest/supportRequest.domain";
import { SupportRequestPolicyService } from "../domain/supportRequest/supportRequestPolicy.service";
import { SupportRequestOrchestratorService } from "../support-logistics/support-request-orchestrator.service";
import { NotificationEventEngine } from "src/domain/notificationEvent/notificationEvent.engine";
import { MailModule } from "src/common/mail/mail.module";

@Module({
  imports: [SupportRequestModuleBase, forwardRef(() => AuthModule), GatewayModule, MailModule],
  controllers: [SupportRequestController],
  providers: [
    SupportRequestService,
    SupportRequestResolver,
    SupportRequestDomain,
    SupportRequestPolicyService,
    SupportRequestOrchestratorService,
    NotificationEventEngine,
  ],
  exports: [SupportRequestService],
})
export class SupportRequestModule {}