import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DeliveryRequestResolverBase } from "./base/deliveryRequest.resolver.base";
import { DeliveryRequest } from "./base/DeliveryRequest";
import { DeliveryRequestService } from "./deliveryRequest.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DeliveryRequest)
export class DeliveryRequestResolver extends DeliveryRequestResolverBase {
  constructor(
    protected readonly service: DeliveryRequestService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
