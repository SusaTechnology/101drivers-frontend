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
  // REFERRAL PROGRAM SETTINGS (admin-configurable)
  // ============================================================
  // Controls the driver referral program. Values are read by
  // ReferralService.applyReferral when a new referral row is created,
  // so changing them in the admin UI takes effect for all NEW
  // referrals immediately. Existing referral rows keep whatever
  // tripsRequired / rewardAmount they were created with.
  // ============================================================

  /**
   * Default referral program policy. Matches the current advertised
   * policy: $150 reward, 30 trips in 30 days, max 10 friends.
   */
  private getDefaultReferralProgramSettings(): ReferralProgramSettingsResponseDto {
    return {
      rewardAmount: 150,
      tripsRequired: 30,
      daysToComplete: 30,
      maxReferrals: 10,
    };
  }

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
      rewardAmount:
        typeof v.rewardAmount === "number" && Number.isFinite(v.rewardAmount) && v.rewardAmount >= 0
          ? v.rewardAmount
          : defaults.rewardAmount,
      tripsRequired:
        typeof v.tripsRequired === "number" && Number.isFinite(v.tripsRequired) && v.tripsRequired >= 1
          ? Math.floor(v.tripsRequired)
          : defaults.tripsRequired,
      daysToComplete:
        typeof v.daysToComplete === "number" && Number.isFinite(v.daysToComplete) && v.daysToComplete >= 1
          ? Math.floor(v.daysToComplete)
          : defaults.daysToComplete,
      maxReferrals:
        typeof v.maxReferrals === "number" && Number.isFinite(v.maxReferrals) && v.maxReferrals >= 1
          ? Math.floor(v.maxReferrals)
          : defaults.maxReferrals,
    };
  }

  async updateReferralProgramSettings(
    input: UpdateReferralProgramSettingsBody
  ): Promise<ReferralProgramSettingsResponseDto> {
    const current = await this.getReferralProgramSettings();

    // Coerce to safe numbers — the DTO validators already reject
    // negatives / non-numbers, but we still clamp here so a partial
    // update (e.g. only rewardAmount) doesn't blow away the others.
    const next: ReferralProgramSettingsResponseDto = {
      rewardAmount:
        input.rewardAmount != null ? Number(input.rewardAmount) : current.rewardAmount,
      tripsRequired:
        input.tripsRequired != null ? Math.floor(Number(input.tripsRequired)) : current.tripsRequired,
      daysToComplete:
        input.daysToComplete != null ? Math.floor(Number(input.daysToComplete)) : current.daysToComplete,
      maxReferrals:
        input.maxReferrals != null ? Math.floor(Number(input.maxReferrals)) : current.maxReferrals,
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