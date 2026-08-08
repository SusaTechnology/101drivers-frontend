import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { PricingConfigService } from "./pricingConfig.service";
import { PricingConfigControllerBase } from "./base/pricingConfig.controller.base";
import { PreviewQuoteBody, SavePricingConfigBody, SetDefaultPricingConfigBody } from "./dto/pricingConfigAdmin.dto";
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

@common.Patch("/:id/set-default")
@swagger.ApiOkResponse({ type: PricingConfig })
@swagger.ApiOperation({
  summary:
    "Mark a PricingConfig as the system-wide default. Atomically unsets " +
    "isDefault on every other PricingConfig. Does NOT modify `active` — " +
    "default and active are independent flags.",
})
@nestAccessControl.UseRoles({
  resource: "PricingConfig",
  action: "update",
  possession: "any",
})
async setDefaultPricingConfig(
  @common.Param("id") id: string,
  @common.Body() body: SetDefaultPricingConfigBody
): Promise<PricingConfig | null> {
  return this.service.setDefaultPricingConfig({
    id,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post("/preview-quote")
@swagger.ApiOkResponse({
  schema: {
    type: "object",
    properties: {
      pricingConfigId: { type: "string" },
      pricingMode: { type: "string", enum: ["PER_MILE", "FLAT_TIER", "CATEGORY_ABC"] },
      mileageCategory: { type: "string", enum: ["A", "B", "C"], nullable: true },
      estimatedPrice: { type: "number" },
      estimatedDriverPayout: { type: "number" },
      feesBreakdown: { type: "object" },
      pricingSnapshot: { type: "object" },
    },
  },
})
@swagger.ApiOperation({
  summary:
    "Preview a quote against a saved PricingConfig. Returns the same " +
    "shape as the real quote-calculation path, but does NOT persist a " +
    "Quote row, does NOT write an audit log, and does NOT consult " +
    "customer overrides (the admin is previewing against the config " +
    "as-saved, not as a specific customer would see it).",
})
@nestAccessControl.UseRoles({
  resource: "PricingConfig",
  action: "read",
  possession: "any",
})
async previewQuote(
  @common.Body() body: PreviewQuoteBody
): Promise<any> {
  return this.service.previewQuote({
    pricingConfigId: body.pricingConfigId,
    distanceMiles: body.distanceMiles,
    serviceType: body.serviceType,
    categoryOverride: body.categoryOverride ?? null,
  });
}
}