import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { EvidenceExportService } from "./evidenceExport.service";
import { EvidenceExportControllerBase } from "./base/evidenceExport.controller.base";

@swagger.ApiTags("evidenceExports")
@common.Controller("evidenceExports")
export class EvidenceExportController extends EvidenceExportControllerBase {
  constructor(
    protected readonly service: EvidenceExportService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
