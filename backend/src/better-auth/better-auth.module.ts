// BetterAuthModule — GLOBAL (JwtAuthGuard in every module injects
// BetterAuthService for the hybrid session check). Imports MailModule for
// the verification/reset email callbacks.

import { Global, Module } from "@nestjs/common";
import { MailModule } from "../common/mail/mail.module";
import { BetterAuthService } from "./better-auth.service";

@Global()
@Module({
  imports: [MailModule],
  providers: [BetterAuthService],
  exports: [BetterAuthService],
})
export class BetterAuthModule {}
