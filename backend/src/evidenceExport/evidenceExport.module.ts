import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EvidenceExportModuleBase } from "./base/evidenceExport.module.base";
import { EvidenceExportService } from "./evidenceExport.service";
import { EvidenceExportController } from "./evidenceExport.controller";
import { EvidenceExportResolver } from "./evidenceExport.resolver";
import { EvidenceExportDomain } from "src/domain/evidenceExport/evidenceExport.domain";
import { EvidenceExportPolicyService } from "src/domain/evidenceExport/evidenceExportPolicy.service";

@Module({
  imports: [EvidenceExportModuleBase, forwardRef(() => AuthModule)],
  controllers: [EvidenceExportController],
  providers: [EvidenceExportService, EvidenceExportResolver, EvidenceExportDomain, EvidenceExportPolicyService],
  exports: [EvidenceExportService],
})
export class EvidenceExportModule {}
