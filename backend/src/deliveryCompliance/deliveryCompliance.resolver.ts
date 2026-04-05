import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DeliveryComplianceResolverBase } from "./base/deliveryCompliance.resolver.base";
import { DeliveryCompliance } from "./base/DeliveryCompliance";
import { DeliveryComplianceService } from "./deliveryCompliance.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DeliveryCompliance)
export class DeliveryComplianceResolver extends DeliveryComplianceResolverBase {
  constructor(
    protected readonly service: DeliveryComplianceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
