import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { PricingConfigService } from "./pricingConfig.service";
import { PricingConfigControllerBase } from "./base/pricingConfig.controller.base";
import { SavePricingConfigBody } from "./dto/pricingConfigAdmin.dto";
import { PricingConfig } from "./base/PricingConfig";

@swagger.ApiTags("pricingConfigs")
@common.Controller("pricingConfigs")
export class PricingConfigController extends PricingConfigControllerBase {
  constructor(
    protected readonly service: PricingConfigService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.Post("/admin-save")
@swagger.ApiOkResponse({ type: PricingConfig })
@nestAccessControl.UseRoles({
  resource: "PricingConfig",
  action: "update",
  possession: "any",
})
async adminSavePricingConfig(
  @common.Body() body: SavePricingConfigBody
): Promise<PricingConfig | null> {
  return this.service.adminSavePricingConfig({
    body,
  });
}
}