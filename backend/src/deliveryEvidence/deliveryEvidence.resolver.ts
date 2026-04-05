import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DeliveryEvidenceResolverBase } from "./base/deliveryEvidence.resolver.base";
import { DeliveryEvidence } from "./base/DeliveryEvidence";
import { DeliveryEvidenceService } from "./deliveryEvidence.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DeliveryEvidence)
export class DeliveryEvidenceResolver extends DeliveryEvidenceResolverBase {
  constructor(
    protected readonly service: DeliveryEvidenceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
