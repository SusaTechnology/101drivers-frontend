import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { NotificationEventResolverBase } from "./base/notificationEvent.resolver.base";
import { NotificationEvent } from "./base/NotificationEvent";
import { NotificationEventService } from "./notificationEvent.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => NotificationEvent)
export class NotificationEventResolver extends NotificationEventResolverBase {
  constructor(
    protected readonly service: NotificationEventService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
