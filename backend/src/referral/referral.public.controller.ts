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
import {
  ReferralTypeDto,
  ReferralReferrerRole,
} from "../appSetting/dto/appSetting.dto";

@swagger.ApiTags("referrals-public")
@common.Controller("referrals/public")
export class ReferralPublicController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * GET /api/referrals/public/resolve/:code
   *
   * Resolve a referral code to its referrer's display name + type.
   * Returns `{ found, referrerName, referrerType, programActive, allows }`.
   *
   * If the code is invalid or not found, returns `found=false` (no
   * error) — the public test-referral page handles the not-found UI.
   *
   * `programActive` mirrors the admin master switch (isActive) — it is
   * the ONLY source of the invite page's "paused" warning. Which signup
   * buttons appear is governed purely by `allows` (the who-refers-whom
   * matrix row for this referrer); the apply endpoints enforce the same
   * matrix server-side, so a hidden button can't be bypassed with a
   * hand-typed ?ref= URL.
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
        referrerSubtype: { type: "string", enum: ["PERSONAL", "BUSINESS"], nullable: true },
        programActive: { type: "boolean" },
        allows: {
          type: "object",
          nullable: true,
          description:
            "Which roles this referrer may refer (who-refers-whom matrix). " +
            "The invite page renders its 3 signup buttons from this and the " +
            "apply endpoints enforce the same cells server-side.",
          properties: {
            DRIVER: { type: "boolean" },
            PERSONAL: { type: "boolean" },
            BUSINESS: { type: "boolean" },
          },
        },
      },
    },
  })
  async resolveReferralCode(
    @common.Param("code") code: string,
  ): Promise<{
    found: boolean;
    referrerName: string | null;
    referrerType: ReferralTypeDto | null;
    referrerSubtype: "PERSONAL" | "BUSINESS" | null;
    programActive: boolean;
    allows: Record<ReferralReferrerRole, boolean> | null;
  }> {
    return this.referralService.publicResolveReferralCode(code);
  }

  /**
   * GET /api/referrals/public/lookup?name=...
   *
   * Public search by name — anyone can type a name and get matching
   * referral codes back. Returns up to 10 results with privacy-masked
   * names. Used by the /test-referral (no code) public lookup page.
   */
  @common.Get("lookup")
  @swagger.ApiOperation({
    summary:
      "Search for referral codes by referrer name. Public (no auth). Returns up to 10 results.",
  })
  @swagger.ApiOkResponse({
    description: "Search results",
    schema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              referrerName: { type: "string" },
              referrerType: { type: "string", enum: ["DRIVER", "CUSTOMER"] },
            },
          },
        },
      },
    },
  })
  async lookupByName(
    @common.Query("name") name: string,
  ): Promise<{
    results: Array<{
      code: string;
      referrerName: string;
      referrerType: ReferralTypeDto;
    }>;
  }> {
    return this.referralService.publicLookupByName(name);
  }
}
