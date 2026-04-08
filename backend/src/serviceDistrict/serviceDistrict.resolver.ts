import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { ServiceDistrictResolverBase } from "./base/serviceDistrict.resolver.base";
import { ServiceDistrict } from "./base/ServiceDistrict";
import { ServiceDistrictService } from "./serviceDistrict.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => ServiceDistrict)
export class ServiceDistrictResolver extends ServiceDistrictResolverBase {
  constructor(
    protected readonly service: ServiceDistrictService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
