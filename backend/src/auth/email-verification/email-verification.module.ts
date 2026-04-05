import { Module } from "@nestjs/common";
import { EmailVerificationService } from "./email-verification.service";
import { PrismaService } from "../../prisma/prisma.service";
import { MailModule } from "src/common/mail/mail.module";

@Module({
  imports: [MailModule],
  providers: [EmailVerificationService, PrismaService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}