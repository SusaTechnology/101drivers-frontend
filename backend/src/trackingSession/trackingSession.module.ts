import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TrackingSessionModuleBase } from "./base/trackingSession.module.base";
import { TrackingSessionService } from "./trackingSession.service";
import { TrackingSessionController } from "./trackingSession.controller";
import { TrackingSessionResolver } from "./trackingSession.resolver";
import { TrackingSessionDomain } from "src/domain/trackingSession/trackingSession.domain";
import { TrackingSessionPolicyService } from "src/domain/trackingSession/trackingSessionPolicy.service";

@Module({
  imports: [TrackingSessionModuleBase, forwardRef(() => AuthModule)],
  controllers: [TrackingSessionController],
  providers: [TrackingSessionService, TrackingSessionResolver, TrackingSessionDomain, TrackingSessionPolicyService],
  exports: [TrackingSessionService],
})
export class TrackingSessionModule {}
