import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportsDomain } from "./reports.domain";
import { ReportExportService } from "./report-export.service";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsDomain, ReportExportService],
  exports: [ReportsService],
})
export class ReportsModule {} 