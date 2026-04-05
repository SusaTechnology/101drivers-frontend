import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { GqlDefaultAuthGuard } from "../auth/gqlDefaultAuth.guard";
import * as common from "@nestjs/common";
import { DealerLeadResolverBase } from "./base/dealerLead.resolver.base";
import { DealerLead } from "./base/DealerLead";
import { DealerLeadService } from "./dealerLead.service";

@common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
@graphql.Resolver(() => DealerLead)
export class DealerLeadResolver extends DealerLeadResolverBase {
  constructor(
    protected readonly service: DealerLeadService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
