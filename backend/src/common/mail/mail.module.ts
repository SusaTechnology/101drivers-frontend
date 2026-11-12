import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminGateModule } from "../../admin-gate/admin-gate.module";
import { MailService } from "./mail.service";

// AdminGateModule (leaf) supplies the month-derived gate key that the
// admin invite email appends to its setup link.
//
// RE-EXPORT RULE (do not remove): MailModule is the only thing most
// feature modules import, yet MailService itself injects
// AdminGateService. Without re-exporting AdminGateModule here, Nest
// instantiates MailService inside the CONSUMING module's context
// (DisputeCaseModule was the first to blow up: "can't resolve
// dependencies of the MailService (ConfigService, ?) ... AdminGateService
// at index [1] ... available in the DisputeCaseModule context") because
// the consumer cannot see AdminGateModule through MailModule. Listing
// AdminGateModule in exports makes it transitive for every importer of
// MailModule — the same pattern the feature modules already rely on.
@Module({
  imports: [ConfigModule, AdminGateModule],
  providers: [MailService],
  exports: [MailService, AdminGateModule],
})
export class MailModule {}