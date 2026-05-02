import { Module } from "@nestjs/common";
import { AdminDashboardController } from "./adminDashboard.controller";
import { AdminDashboardService } from "./adminDashboard.service";
import { AdminDashboardDomain } from "../domain/adminDashboard/adminDashboard.domain";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService, AdminDashboardDomain],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule {}