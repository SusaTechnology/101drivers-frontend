import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { InvestorLeadResolverBase } from "./base/investorLead.resolver.base";
import { InvestorLead } from "./base/InvestorLead";
import { InvestorLeadService } from "./investorLead.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => InvestorLead)
export class InvestorLeadResolver extends InvestorLeadResolverBase {
  constructor(
    protected readonly service: InvestorLeadService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
