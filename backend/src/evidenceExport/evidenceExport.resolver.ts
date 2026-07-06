import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { EvidenceExportResolverBase } from "./base/evidenceExport.resolver.base";
import { EvidenceExport } from "./base/EvidenceExport";
import { EvidenceExportService } from "./evidenceExport.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => EvidenceExport)
export class EvidenceExportResolver extends EvidenceExportResolverBase {
  constructor(
    protected readonly service: EvidenceExportService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
