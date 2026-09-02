// src/pricingConfig/pricingConfig.public.controller.ts
import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { PricingConfigService } from "./pricingConfig.service";
import { PublicPricingConfigDto } from "./dto/pricingConfigPublic.dto";

/**
 * Public (unauthenticated) pricing config endpoints.
 *
 * Mounted at `/api/pricingConfigs/public/*` — same prefix as the admin
 * PricingConfigController, but this controller applies NO auth guards
 * and exposes only a sanitized, public-facing subset of fields.
 *
 * Currently the only route is `GET /default`, used by the home page
 * quote widget so that admin-configured pricing changes are reflected
 * on the landing page without a frontend redeploy.
 *
 * Convention follows `AppSettingPublicController`
 * (backend/src/appSetting/appSettings.public.controller.ts) and
 * `DeliveryRequestPublicController`
 * (backend/src/deliveryRequest/deliveryRequest.public.controller.ts):
 * no `@UseGuards`, no `@Public()` decorator — public-ness comes purely
 * from the absence of an auth guard on this controller.
 */
@swagger.ApiTags("pricingConfigs-public")
@common.Controller("pricingConfigs/public")
export class PricingConfigPublicController {
  constructor(protected readonly service: PricingConfigService) {}

  /**
   * GET /api/pricingConfigs/public/default
   *
   * Returns the currently active default pricing config — sanitized to
   * only the public-facing fields needed to advertise the rate and
   * compute a quote preview.
   *
   * Returns `null` (200 OK with null body) when no active config
   * exists. The frontend should fall back to its hard-coded advertised
   * rate in that case (see src/lib/pricing/home-flat-quote.ts).
   *
   * Cache semantics:
   *   - Frontend `staleTime`: 5 minutes (TanStack Query default)
   *   - No HTTP caching headers set here — leave it to the CDN/edge
   *     to decide based on deployment config.
   */
  @common.Get("default")
  @swagger.ApiOperation({
    summary:
      "Public default pricing config — sanitized, no auth required. Used by the landing page quote widget.",
  })
  @swagger.ApiOkResponse({
    type: PublicPricingConfigDto,
    description:
      "The active default pricing config (sanitized). null if no active config exists.",
  })
  @swagger.ApiNotFoundResponse({
    description: "Never thrown — returns null instead.",
  })
  async getDefault(): Promise<PublicPricingConfigDto | null> {
    return this.service.getPublicDefaultPricingConfig();
  }
}
