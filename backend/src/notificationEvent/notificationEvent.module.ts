import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationEventModuleBase } from "./base/notificationEvent.module.base";
import { NotificationEventService } from "./notificationEvent.service";
import { NotificationEventController } from "./notificationEvent.controller";
import { NotificationEventResolver } from "./notificationEvent.resolver";
import { NotificationEventDomain } from "src/domain/notificationEvent/notificationEvent.domain";
import { NotificationEventPolicyService } from "src/domain/notificationEvent/notificationEventPolicy.service";

@Module({
  imports: [NotificationEventModuleBase, forwardRef(() => AuthModule)],
  controllers: [NotificationEventController],
  providers: [NotificationEventService, NotificationEventResolver, NotificationEventDomain, NotificationEventPolicyService],
  exports: [NotificationEventService],
})
export class NotificationEventModule {}
