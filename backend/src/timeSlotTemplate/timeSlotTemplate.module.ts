import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TimeSlotTemplateModuleBase } from "./base/timeSlotTemplate.module.base";
import { TimeSlotTemplateService } from "./timeSlotTemplate.service";
import { TimeSlotTemplateController } from "./timeSlotTemplate.controller";
import { TimeSlotTemplateResolver } from "./timeSlotTemplate.resolver";
import { TimeSlotTemplatePolicyService } from "src/domain/timeSlotTemplate/timeSlotTemplatePolicy.service";
import { TimeSlotTemplateDomain } from "src/domain/timeSlotTemplate/timeSlotTemplate.domain";

@Module({
  imports: [TimeSlotTemplateModuleBase, forwardRef(() => AuthModule)],
  controllers: [TimeSlotTemplateController],
  providers: [TimeSlotTemplateService, TimeSlotTemplateResolver, TimeSlotTemplateDomain, TimeSlotTemplatePolicyService],
  exports: [TimeSlotTemplateService],
})
export class TimeSlotTemplateModule {}
