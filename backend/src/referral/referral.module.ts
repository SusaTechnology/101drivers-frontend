import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingModule } from "../appSetting/appSetting.module";
import { ReferralController } from "./referral.controller";
import { ReferralService } from "./referral.service";

@Module({
  imports: [forwardRef(() => AuthModule), AppSettingModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
