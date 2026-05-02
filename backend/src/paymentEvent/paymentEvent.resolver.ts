import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { PaymentEventResolverBase } from "./base/paymentEvent.resolver.base";
import { PaymentEvent } from "./base/PaymentEvent";
import { PaymentEventService } from "./paymentEvent.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => PaymentEvent)
export class PaymentEventResolver extends PaymentEventResolverBase {
  constructor(
    protected readonly service: PaymentEventService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
