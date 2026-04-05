import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DeliveryStatusHistoryResolverBase } from "./base/deliveryStatusHistory.resolver.base";
import { DeliveryStatusHistory } from "./base/DeliveryStatusHistory";
import { DeliveryStatusHistoryService } from "./deliveryStatusHistory.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DeliveryStatusHistory)
export class DeliveryStatusHistoryResolver extends DeliveryStatusHistoryResolverBase {
  constructor(
    protected readonly service: DeliveryStatusHistoryService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
