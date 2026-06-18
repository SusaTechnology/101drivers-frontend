import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralController } from "./referral.controller";

@Module({
  imports: [],
  controllers: [ReferralController],
  providers: [PrismaService],
  exports: [],
})
export class ReferralModule {}
