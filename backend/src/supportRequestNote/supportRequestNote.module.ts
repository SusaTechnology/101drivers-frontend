import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupportRequestNoteModuleBase } from "./base/supportRequestNote.module.base";
import { SupportRequestNoteService } from "./supportRequestNote.service";
import { SupportRequestNoteController } from "./supportRequestNote.controller";
import { SupportRequestNoteResolver } from "./supportRequestNote.resolver";

@Module({
  imports: [SupportRequestNoteModuleBase, forwardRef(() => AuthModule)],
  controllers: [SupportRequestNoteController],
  providers: [SupportRequestNoteService, SupportRequestNoteResolver],
  exports: [SupportRequestNoteService],
})
export class SupportRequestNoteModule {}
