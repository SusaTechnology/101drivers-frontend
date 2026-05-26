import { Module } from "@nestjs/common";
import { SchedulingPolicyModuleBase } from "./base/schedulingPolicy.module.base";
import { SchedulingPolicyService } from "./schedulingPolicy.service";
import { SchedulingPolicyController } from "./schedulingPolicy.controller";
import { SchedulingPolicyResolver } from "./schedulingPolicy.resolver";
import { SchedulingPolicyDomain } from "../domain/schedulingPolicy/schedulingPolicy.domain";
import { SchedulingPolicyPolicyService } from "../domain/schedulingPolicy/schedulingPolicyPolicy.service";
import { SchedulingPolicyEngineModule } from "../domain/schedulingPolicy/schedulingPolicy.module";

@Module({
  imports: [SchedulingPolicyModuleBase, SchedulingPolicyEngineModule],
  controllers: [SchedulingPolicyController],
  providers: [
    SchedulingPolicyService,
    SchedulingPolicyResolver,
    SchedulingPolicyDomain,
    SchedulingPolicyPolicyService,
  ],
  exports: [SchedulingPolicyService],
})
export class SchedulingPolicyModule {}