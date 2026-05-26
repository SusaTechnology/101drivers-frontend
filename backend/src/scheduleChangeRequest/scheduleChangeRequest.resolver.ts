import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { ScheduleChangeRequestResolverBase } from "./base/scheduleChangeRequest.resolver.base";
import { ScheduleChangeRequest } from "./base/ScheduleChangeRequest";
import { ScheduleChangeRequestService } from "./scheduleChangeRequest.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => ScheduleChangeRequest)
export class ScheduleChangeRequestResolver extends ScheduleChangeRequestResolverBase {
  constructor(
    protected readonly service: ScheduleChangeRequestService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
