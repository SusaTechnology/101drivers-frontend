import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmailVerificationTokenModuleBase } from "./base/emailVerificationToken.module.base";
import { EmailVerificationTokenService } from "./emailVerificationToken.service";
import { EmailVerificationTokenController } from "./emailVerificationToken.controller";
import { EmailVerificationTokenResolver } from "./emailVerificationToken.resolver";

@Module({
  imports: [EmailVerificationTokenModuleBase, forwardRef(() => AuthModule)],
  controllers: [EmailVerificationTokenController],
  providers: [EmailVerificationTokenService, EmailVerificationTokenResolver],
  exports: [EmailVerificationTokenService],
})
export class EmailVerificationTokenModule {}
