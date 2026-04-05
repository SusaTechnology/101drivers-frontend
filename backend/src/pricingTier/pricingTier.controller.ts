import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { PricingTierService } from "./pricingTier.service";
import { PricingTierControllerBase } from "./base/pricingTier.controller.base";

@swagger.ApiTags("pricingTiers")
@common.Controller("pricingTiers")
export class PricingTierController extends PricingTierControllerBase {
  constructor(
    protected readonly service: PricingTierService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
}
