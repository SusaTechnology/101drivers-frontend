import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ScheduleChangeRequestModuleBase } from "./base/scheduleChangeRequest.module.base";
import { ScheduleChangeRequestService } from "./scheduleChangeRequest.service";
import { ScheduleChangeRequestController } from "./scheduleChangeRequest.controller";
import { ScheduleChangeRequestResolver } from "./scheduleChangeRequest.resolver";
import { ScheduleChangeRequestDomain } from "src/domain/scheduleChangeRequest/scheduleChangeRequest.domain";
import { ScheduleChangeRequestPolicyService } from "src/domain/scheduleChangeRequest/scheduleChangeRequestPolicy.service";
import { ScheduleChangeEngine } from "src/domain/scheduleChangeRequest/scheduleChange.engine";
import { DeliveryLogisticsModule } from "../delivery-logistics/delivery-logistics.module";

@Module({
  imports: [
    ScheduleChangeRequestModuleBase,
    forwardRef(() => AuthModule),
    DeliveryLogisticsModule,
  ],
  controllers: [ScheduleChangeRequestController],
  providers: [
    ScheduleChangeRequestService,
    ScheduleChangeRequestResolver,
    ScheduleChangeRequestDomain,
    ScheduleChangeRequestPolicyService,
    ScheduleChangeEngine,
  ],
  exports: [ScheduleChangeRequestService],
})
export class ScheduleChangeRequestModule {}