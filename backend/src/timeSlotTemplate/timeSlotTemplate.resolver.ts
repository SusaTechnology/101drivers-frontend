import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { TimeSlotTemplateResolverBase } from "./base/timeSlotTemplate.resolver.base";
import { TimeSlotTemplate } from "./base/TimeSlotTemplate";
import { TimeSlotTemplateService } from "./timeSlotTemplate.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => TimeSlotTemplate)
export class TimeSlotTemplateResolver extends TimeSlotTemplateResolverBase {
  constructor(
    protected readonly service: TimeSlotTemplateService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
