import { Injectable } from "@nestjs/common";
import {
  AppSetting as PrismaAppSetting,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AppSettingServiceBase } from "./base/appSetting.service.base";
import { AppSettingDomain } from "../domain/appSetting/appSetting.domain";
import { AppSettingPolicyService } from "../domain/appSetting/appSettingPolicy.service";

import {
  LandingPageSettingsResponseDto,
  UpdateLandingPageSettingsBody,
  DeliverySettingsResponseDto,
  UpdateDeliverySettingsBody,
  ReferralProgramSettingsResponseDto,
  UpdateReferralProgramSettingsBody,
  ReferralRewardTrigger,
  ReferralTimeLimitMode,
  ReferralPayoutModelDto,
} from "./dto/appSetting.dto";

const LANDING_PAGE_SETTINGS_KEY = "LANDING_PAGE_SETTINGS";
const DELIVERY_SETTINGS_KEY = "DELIVERY_SETTINGS";
const REFERRAL_PROGRAM_SETTINGS_KEY = "REFERRAL_PROGRAM_SETTINGS";

type LandingPageSettingsValue = {
  fundraisingEnabled: boolean;
  dealerLeadEnabled: boolean;
  investorLeadEnabled: boolean;

  investorDeckTitle: string | null;
  investorDeckUrl: string | null;
  investorDeckFilename: string | null;
  investorDeckUploadedAt: string | null;

  dealerLeadCtaTitle: string | null;
  dealerLeadCtaDescription: string | null;

  investorLeadCtaTitle: string | null;
  investorLeadCtaDescription: string | null;
};

@Injectable()
export class AppSettingService extends AppSettingServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: AppSettingDomain,
    private readonly policy: AppSettingPolicyService
  ) {
    super(prisma);
  }

  // ============================================================
  // BASE CRUD (keep as is)
  // ============================================================

  async count(
    args: Omit<Prisma.AppSettingCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.appSetting.count(args);
  }

  async appSettings(args: Prisma.AppSettingFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async appSetting(args: Prisma.AppSettingFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createAppSetting(args: Prisma.AppSettingCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.appSetting.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateAppSetting(args: Prisma.AppSettingUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.appSetting.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteAppSetting(
    args: Prisma.AppSettingDeleteArgs
  ): Promise<PrismaAppSetting> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.appSetting.delete(args);
  }

  // ============================================================
  // LANDING PAGE SETTINGS (CUSTOM LOGIC)
  // ============================================================

  private getDefaultLandingPageSettings(): LandingPageSettingsValue {
    return {
      fundraisingEnabled: true,
      dealerLeadEnabled: true,
      investorLeadEnabled: true,

      investorDeckTitle: null,
      investorDeckUrl: null,
      investorDeckFilename: null,
      investorDeckUploadedAt: null,

      dealerLeadCtaTitle: "Onboard My Dealership",
      dealerLeadCtaDescription:
        "Request a call and get your dealership onboarded.",

      investorLeadCtaTitle: "Request Investor Deck",
      investorLeadCtaDescription:
        "Support, sponsor, donate, or request the investor deck.",
    };
  }

  async getLandingPageSettings(): Promise<LandingPageSettingsResponseDto> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: LANDING_PAGE_SETTINGS_KEY },
      select: { value: true },
    });

    const defaults = this.getDefaultLandingPageSettings();

    const value =
      row?.value && typeof row.value === "object"
        ? (row.value as Partial<LandingPageSettingsValue>)
        : {};

    return {
      ...defaults,
      ...value,
    };
  }

  async getPublicLandingPageSettings(): Promise<
    Omit<LandingPageSettingsResponseDto, "investorDeckFilename" | "investorDeckUploadedAt">
  > {
    const full = await this.getLandingPageSettings();

    return {
      fundraisingEnabled: full.fundraisingEnabled,
      dealerLeadEnabled: full.dealerLeadEnabled,
      investorLeadEnabled: full.investorLeadEnabled,

      investorDeckTitle: full.investorDeckTitle,
      investorDeckUrl: full.investorDeckUrl,

      dealerLeadCtaTitle: full.dealerLeadCtaTitle,
      dealerLeadCtaDescription: full.dealerLeadCtaDescription,

      investorLeadCtaTitle: full.investorLeadCtaTitle,
      investorLeadCtaDescription: full.investorLeadCtaDescription,
    };
  }

  async updateLandingPageSettings(
    input: UpdateLandingPageSettingsBody
  ): Promise<LandingPageSettingsResponseDto> {
    const current = await this.getLandingPageSettings();

    const next: LandingPageSettingsValue = {
      ...current,
      ...input,

      investorDeckTitle: this.cleanNullableString(
        input.investorDeckTitle ?? current.investorDeckTitle
      ),

      investorDeckUrl: this.cleanNullableString(
        input.investorDeckUrl ?? current.investorDeckUrl
      ),

      investorDeckFilename: this.cleanNullableString(
        input.investorDeckFilename ?? current.investorDeckFilename
      ),

      dealerLeadCtaTitle: this.cleanNullableString(
        input.dealerLeadCtaTitle ?? current.dealerLeadCtaTitle
      ),

      dealerLeadCtaDescription: this.cleanNullableString(
        input.dealerLeadCtaDescription ?? current.dealerLeadCtaDescription
      ),

      investorLeadCtaTitle: this.cleanNullableString(
        input.investorLeadCtaTitle ?? current.investorLeadCtaTitle
      ),

      investorLeadCtaDescription: this.cleanNullableString(
        input.investorLeadCtaDescription ??
          current.investorLeadCtaDescription
      ),

      investorDeckUploadedAt:
        input.investorDeckUrl !== undefined
          ? input.investorDeckUrl
            ? new Date().toISOString()
            : null
          : current.investorDeckUploadedAt,
    };

    await this.prisma.appSetting.upsert({
      where: { key: LANDING_PAGE_SETTINGS_KEY },
      create: {
        key: LANDING_PAGE_SETTINGS_KEY,
        value: next as any,
      },
      update: {
        value: next as any,
      },
    });

    return next;
  }

  // ============================================================
  // DELIVERY SETTINGS (max radius + transit buffer)
  // ============================================================

  async getDeliverySettings(): Promise<{ maximumRadiusMiles: number; transitBufferMinutes: number }> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: DELIVERY_SETTINGS_KEY },
      select: { value: true },
    });

    const defaults = { maximumRadiusMiles: 25, transitBufferMinutes: 60 };
    const value = row?.value && typeof row.value === "object" ? row.value : {};
    return { ...defaults, ...value };
  }

  async updateDeliverySettings(input: { maximumRadiusMiles?: number; transitBufferMinutes?: number }): Promise<{ maximumRadiusMiles: number; transitBufferMinutes: number }> {
    const current = await this.getDeliverySettings();
    const next = {
      maximumRadiusMiles: input.maximumRadiusMiles ?? current.maximumRadiusMiles,
      transitBufferMinutes: input.transitBufferMinutes ?? current.transitBufferMinutes,
    };

    await this.prisma.appSetting.upsert({
      where: { key: DELIVERY_SETTINGS_KEY },
      create: { key: DELIVERY_SETTINGS_KEY, value: next as any },
      update: { value: next as any },
    });

    return next;
  }

  // ============================================================
  // REFERRAL PROGRAM SETTINGS (admin-configurable, tiered model)
  // ============================================================
  // Drives the driver referral program. The referrer earns
  // `referrerRewardAmount` for every `referralThreshold` of
  // SUCCESSFUL referrals (tiered). The referred driver earns a
  // one-shot `referredRewardAmount` when their referral becomes
  // successful (per-referral).
  //
  // Per-referral policy (rewardTrigger, requiredDeliveries, window
  // dates, referredRewardAmount) is SNAPSHOT onto each Referral row
  // at applyReferral time. The referrer-tier policy (referralThreshold,
  // referrerRewardAmount) is read LIVE at trigger time so the admin
  // can adjust incentives mid-program.
  // ============================================================

  /**
   * Default referral program policy. Matches the current advertised
   * policy: $150 to referrer per 20 successful referrals, $150 to
   * the referred driver once when they complete 30 deliveries within
   * a 1-year calendar window.
   */
  private getDefaultReferralProgramSettings(): ReferralProgramSettingsResponseDto {
    // Default window: 1 year from now (renewed each time the admin
    // resets, but stable enough for first run).
    const now = new Date();
    const windowStart = now.toISOString();
    const windowEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

    return {
      isActive: true,
      rewardTrigger: ReferralRewardTrigger.ON_DELIVERIES_COMPLETED,
      requiredDeliveries: 30,
      timeLimitMode: ReferralTimeLimitMode.CALENDAR_RANGE,
      windowStartDate: windowStart,
      windowEndDate: windowEnd,
      referrerRewardAmount: 150,
      referralThreshold: 20,
      referredGetsReward: true,
      referredRewardAmount: 150,
      // ── PER_DELIVERY defaults (Phase 2) ──
      // Default payout model is TIERED for backward compatibility — existing
      // referrer snapshots are TIERED, so we don't silently switch them.
      payoutModel: ReferralPayoutModelDto.TIERED,
      // $5 to referrer per paid delivery
      perDeliveryReferrerAmountCents: 500,
      // $50 bonus to the referred party
      perDeliveryReferredBonusCents: 5000,
      // Bonus fires on the 5th paid delivery
      perDeliveryBonusTriggerCount: 5,
      // Both referral types enabled by default
      customerReferralsEnabled: true,
      driverReferralsEnabled: true,
    };
  }

  /**
   * Read the live referral program config. Returns the default policy
   * if no row exists yet, or a merged shape if the stored row is
   * partial (legacy / future-tolerant).
   */
  async getReferralProgramSettings(): Promise<ReferralProgramSettingsResponseDto> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: REFERRAL_PROGRAM_SETTINGS_KEY },
      select: { value: true },
    });

    const defaults = this.getDefaultReferralProgramSettings();

    if (!row?.value || typeof row.value !== "object") {
      return defaults;
    }

    const v = row.value as Partial<ReferralProgramSettingsResponseDto>;

    // Merge with defaults so a partial / legacy value blob still
    // returns a complete shape — every field has a sane fallback.
    return {
      isActive: typeof v.isActive === "boolean" ? v.isActive : defaults.isActive,
      rewardTrigger:
        v.rewardTrigger === ReferralRewardTrigger.ON_APPROVED ||
        v.rewardTrigger === ReferralRewardTrigger.ON_DELIVERIES_COMPLETED
          ? v.rewardTrigger
          : defaults.rewardTrigger,
      requiredDeliveries:
        typeof v.requiredDeliveries === "number" &&
        Number.isFinite(v.requiredDeliveries) &&
        v.requiredDeliveries >= 1
          ? Math.floor(v.requiredDeliveries)
          : defaults.requiredDeliveries,
      timeLimitMode:
        v.timeLimitMode === ReferralTimeLimitMode.CALENDAR_RANGE ||
        v.timeLimitMode === ReferralTimeLimitMode.FOREVER
          ? v.timeLimitMode
          : defaults.timeLimitMode,
      windowStartDate:
        typeof v.windowStartDate === "string" ? v.windowStartDate : defaults.windowStartDate,
      windowEndDate:
        typeof v.windowEndDate === "string" ? v.windowEndDate : defaults.windowEndDate,
      referrerRewardAmount:
        typeof v.referrerRewardAmount === "number" &&
        Number.isFinite(v.referrerRewardAmount) &&
        v.referrerRewardAmount >= 0
          ? v.referrerRewardAmount
          : defaults.referrerRewardAmount,
      referralThreshold:
        typeof v.referralThreshold === "number" &&
        Number.isFinite(v.referralThreshold) &&
        v.referralThreshold >= 1
          ? Math.floor(v.referralThreshold)
          : defaults.referralThreshold,
      referredGetsReward:
        typeof v.referredGetsReward === "boolean" ? v.referredGetsReward : defaults.referredGetsReward,
      referredRewardAmount:
        typeof v.referredRewardAmount === "number" && Number.isFinite(v.referredRewardAmount) && v.referredRewardAmount >= 0
          ? v.referredRewardAmount
          : v.referredGetsReward === false
            ? null
            : defaults.referredRewardAmount,
      // ── PER_DELIVERY model fields (Phase 2) ──
      payoutModel:
        v.payoutModel === ReferralPayoutModelDto.TIERED ||
        v.payoutModel === ReferralPayoutModelDto.PER_DELIVERY
          ? v.payoutModel
          : defaults.payoutModel,
      perDeliveryReferrerAmountCents:
        typeof v.perDeliveryReferrerAmountCents === "number" &&
        Number.isFinite(v.perDeliveryReferrerAmountCents) &&
        v.perDeliveryReferrerAmountCents >= 0
          ? Math.floor(v.perDeliveryReferrerAmountCents)
          : defaults.perDeliveryReferrerAmountCents,
      perDeliveryReferredBonusCents:
        typeof v.perDeliveryReferredBonusCents === "number" &&
        Number.isFinite(v.perDeliveryReferredBonusCents) &&
        v.perDeliveryReferredBonusCents >= 0
          ? Math.floor(v.perDeliveryReferredBonusCents)
          : defaults.perDeliveryReferredBonusCents,
      perDeliveryBonusTriggerCount:
        typeof v.perDeliveryBonusTriggerCount === "number" &&
        Number.isFinite(v.perDeliveryBonusTriggerCount) &&
        v.perDeliveryBonusTriggerCount >= 1
          ? Math.floor(v.perDeliveryBonusTriggerCount)
          : defaults.perDeliveryBonusTriggerCount,
      customerReferralsEnabled:
        typeof v.customerReferralsEnabled === "boolean"
          ? v.customerReferralsEnabled
          : defaults.customerReferralsEnabled,
      driverReferralsEnabled:
        typeof v.driverReferralsEnabled === "boolean"
          ? v.driverReferralsEnabled
          : defaults.driverReferralsEnabled,
    };
  }

  async updateReferralProgramSettings(
    input: UpdateReferralProgramSettingsBody
  ): Promise<ReferralProgramSettingsResponseDto> {
    const current = await this.getReferralProgramSettings();

    // Compute the next shape, merging partial input onto current.
    const next: ReferralProgramSettingsResponseDto = {
      isActive: input.isActive != null ? input.isActive : current.isActive,
      rewardTrigger: input.rewardTrigger != null ? input.rewardTrigger : current.rewardTrigger,
      requiredDeliveries:
        input.requiredDeliveries != null
          ? Math.floor(Number(input.requiredDeliveries))
          : current.requiredDeliveries,
      timeLimitMode: input.timeLimitMode != null ? input.timeLimitMode : current.timeLimitMode,
      windowStartDate:
        input.windowStartDate !== undefined
          ? input.windowStartDate
          : current.windowStartDate,
      windowEndDate:
        input.windowEndDate !== undefined ? input.windowEndDate : current.windowEndDate,
      referrerRewardAmount:
        input.referrerRewardAmount != null
          ? Number(input.referrerRewardAmount)
          : current.referrerRewardAmount,
      referralThreshold:
        input.referralThreshold != null
          ? Math.floor(Number(input.referralThreshold))
          : current.referralThreshold,
      referredGetsReward:
        input.referredGetsReward != null ? input.referredGetsReward : current.referredGetsReward,
      referredRewardAmount:
        input.referredRewardAmount !== undefined
          ? input.referredRewardAmount
          : current.referredRewardAmount,
      // ── PER_DELIVERY model fields (Phase 2) ──
      payoutModel:
        input.payoutModel != null ? input.payoutModel : current.payoutModel,
      perDeliveryReferrerAmountCents:
        input.perDeliveryReferrerAmountCents != null
          ? Math.floor(Number(input.perDeliveryReferrerAmountCents))
          : current.perDeliveryReferrerAmountCents,
      perDeliveryReferredBonusCents:
        input.perDeliveryReferredBonusCents != null
          ? Math.floor(Number(input.perDeliveryReferredBonusCents))
          : current.perDeliveryReferredBonusCents,
      perDeliveryBonusTriggerCount:
        input.perDeliveryBonusTriggerCount != null
          ? Math.floor(Number(input.perDeliveryBonusTriggerCount))
          : current.perDeliveryBonusTriggerCount,
      customerReferralsEnabled:
        input.customerReferralsEnabled != null
          ? input.customerReferralsEnabled
          : current.customerReferralsEnabled,
      driverReferralsEnabled:
        input.driverReferralsEnabled != null
          ? input.driverReferralsEnabled
          : current.driverReferralsEnabled,
    };

    // Cross-field validation: if CALENDAR_RANGE, both dates must be set.
    if (
      next.timeLimitMode === ReferralTimeLimitMode.CALENDAR_RANGE &&
      (!next.windowStartDate || !next.windowEndDate)
    ) {
      throw new Error(
        "Referral program: windowStartDate and windowEndDate are required when timeLimitMode = CALENDAR_RANGE"
      );
    }

    // Cross-field validation: if referredGetsReward=false, clear the referredRewardAmount.
    if (!next.referredGetsReward) {
      next.referredRewardAmount = null;
    } else if (next.referredRewardAmount == null) {
      // If admin just flipped referredGetsReward=true but didn't provide an amount,
      // fall back to the referrerRewardAmount (symmetric default).
      next.referredRewardAmount = next.referrerRewardAmount;
    }

    await this.prisma.appSetting.upsert({
      where: { key: REFERRAL_PROGRAM_SETTINGS_KEY },
      create: { key: REFERRAL_PROGRAM_SETTINGS_KEY, value: next as any },
      update: { value: next as any },
    });

    return next;
  }

  /**
   * Toggle just the `isActive` flag — separate from the full config
   * update so the admin can pause/resume the program WITHOUT having
   * to fill in all the other fields (which the full update endpoint
   * validates).
   *
   * Used by the dedicated "Activate" / "Deactivate" button on the
   * admin UI. Does NOT run cross-field validation — it just flips
   * the boolean on the existing config row.
   *
   * If no config row exists yet, this seeds it with the defaults +
   * the requested isActive value.
   */
  async setReferralProgramActive(isActive: boolean): Promise<ReferralProgramSettingsResponseDto> {
    const current = await this.getReferralProgramSettings();
    const next: ReferralProgramSettingsResponseDto = {
      ...current,
      isActive,
    };
    await this.prisma.appSetting.upsert({
      where: { key: REFERRAL_PROGRAM_SETTINGS_KEY },
      create: { key: REFERRAL_PROGRAM_SETTINGS_KEY, value: next as any },
      update: { value: next as any },
    });
    return next;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private normalizeCreateData(
    data: Prisma.AppSettingCreateArgs["data"]
  ): Prisma.AppSettingCreateArgs["data"] {
    const normalized: any = { ...data };
    normalized.key = this.trimRequiredString(normalized.key);
    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.AppSettingUpdateArgs["data"]
  ): Prisma.AppSettingUpdateArgs["data"] {
    const normalized: any = { ...data };
    this.normalizeUpdateStringField(normalized, "key");
    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") return value as string;
    return value.trim();
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) return;

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.trimRequiredString(raw.set),
      };
      return;
    }

    target[field] = this.trimRequiredString(raw);
  }

  private cleanNullableString(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = `${value}`.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}