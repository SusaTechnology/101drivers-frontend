import { Module } from "@nestjs/common";
import { AdminEmailsController } from "./adminEmails.controller";
import { AdminEmailsService } from "./adminEmails.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AdminEmailsController],
  providers: [AdminEmailsService],
  exports: [AdminEmailsService],
})
export class AdminEmailsModule {}
