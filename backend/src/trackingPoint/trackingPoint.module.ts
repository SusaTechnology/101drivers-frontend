import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TrackingPointModuleBase } from "./base/trackingPoint.module.base";
import { TrackingPointService } from "./trackingPoint.service";
import { TrackingPointController } from "./trackingPoint.controller";
import { TrackingPointResolver } from "./trackingPoint.resolver";
import { TrackingPointDomain } from "src/domain/trackingPoint/trackingPoint.domain";
import { TrackingPointPolicyService } from "src/domain/trackingPoint/trackingPointPolicy.service";

@Module({
  imports: [TrackingPointModuleBase, forwardRef(() => AuthModule)],
  controllers: [TrackingPointController],
  providers: [TrackingPointService, TrackingPointResolver, TrackingPointDomain, TrackingPointPolicyService],
  exports: [TrackingPointService],
})
export class TrackingPointModule {}
