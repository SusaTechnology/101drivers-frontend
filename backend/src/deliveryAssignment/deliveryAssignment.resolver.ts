import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DeliveryAssignmentResolverBase } from "./base/deliveryAssignment.resolver.base";
import { DeliveryAssignment } from "./base/DeliveryAssignment";
import { DeliveryAssignmentService } from "./deliveryAssignment.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DeliveryAssignment)
export class DeliveryAssignmentResolver extends DeliveryAssignmentResolverBase {
  constructor(
    protected readonly service: DeliveryAssignmentService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
