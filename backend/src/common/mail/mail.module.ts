import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminGateModule } from "../../admin-gate/admin-gate.module";
import { MailService } from "./mail.service";

// AdminGateModule (leaf) supplies the month-derived gate key that the
// admin invite email appends to its setup link.
@Module({
  imports: [ConfigModule, AdminGateModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}