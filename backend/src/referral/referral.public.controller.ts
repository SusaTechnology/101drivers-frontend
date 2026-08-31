/**
 * Public referral endpoints — no auth required.
 *
 * Mounted at /api/referrals/public.
 *
 * Currently provides one endpoint:
 *   GET /api/referrals/public/resolve/:code
 *     Resolves a referral code to the referrer's display name + type
 *     (driver vs customer) + program-active flag. Used by the public
 *     /test-referral/:code page to show "You're about to sign up with
 *     John S.'s referral code" before redirecting to the signup form.
 *
 * The endpoint returns minimal info — just enough for the user to
 * recognize whose code it is. Personal names are privacy-masked (first
 * name + last initial). Business names are returned in full (they're
 * public anyway).
 *
 * The endpoint does NOT reveal:
 *   - Email addresses
 *   - Phone numbers
 *   - The referrer's user ID or driver/customer ID
 *   - Whether the referrer has earned payouts (or how much)
 */
import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { ReferralService } from "./referral.service";
import { ReferralTypeDto } from "../appSetting/dto/appSetting.dto";

@swagger.ApiTags("referrals-public")
@common.Controller("referrals/public")
export class ReferralPublicController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * GET /api/referrals/public/resolve/:code
   *
   * Resolve a referral code to its referrer's display name + type.
   * Returns `{ found, referrerName, referrerType, programActive }`.
   *
   * If the code is invalid or not found, returns `found=false` (no
   * error) — the public test-referral page handles the not-found UI.
   *
   * If the program is paused (`isActive=false` or `driverReferralsEnabled=false`
   * / `customerReferralsEnabled=false`), the `programActive` field reflects
   * whether new referrals of the relevant type can be created. The
   * frontend uses this to show a "Referral program is paused" notice
   * BEFORE redirecting to the signup form (which would reject the code).
   */
  @common.Get("resolve/:code")
  @swagger.ApiOperation({
    summary:
      "Resolve a referral code to its referrer's display name. Public (no auth).",
  })
  @swagger.ApiOkResponse({
    description: "Referral code resolution result",
    schema: {
      type: "object",
      properties: {
        found: { type: "boolean" },
        referrerName: { type: "string", nullable: true },
        referrerType: { type: "string", enum: ["DRIVER", "CUSTOMER"], nullable: true },
        programActive: { type: "boolean" },
      },
    },
  })
  async resolveReferralCode(
    @common.Param("code") code: string,
  ): Promise<{
    found: boolean;
    referrerName: string | null;
    referrerType: ReferralTypeDto | null;
    programActive: boolean;
  }> {
    return this.referralService.publicResolveReferralCode(code);
  }
}
