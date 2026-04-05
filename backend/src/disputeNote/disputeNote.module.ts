import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DisputeNoteModuleBase } from "./base/disputeNote.module.base";
import { DisputeNoteService } from "./disputeNote.service";
import { DisputeNoteController } from "./disputeNote.controller";
import { DisputeNoteResolver } from "./disputeNote.resolver";
import { DisputeNoteDomain } from "src/domain/disputeNote/disputeNote.domain";
import { DisputeNotePolicyService } from "src/domain/disputeNote/disputeNotePolicy.service";

@Module({
  imports: [DisputeNoteModuleBase, forwardRef(() => AuthModule)],
  controllers: [DisputeNoteController],
  providers: [DisputeNoteService, DisputeNoteResolver, DisputeNoteDomain, DisputeNotePolicyService],
  exports: [DisputeNoteService],
})
export class DisputeNoteModule {}
