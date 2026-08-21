import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingService: AppSettingService,
  ) {}

  /**
   * Resolve the driver record from the authenticated user's JWT payload.
   * req.user only contains { id, username, roles } from the JWT — no profileId.
   */
  async resolveDriverId(req: any): Promise<string> {
    const userId = (req as any).user?.id;
    if (!userId) throw new NotFoundException("Not authenticated");

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException("Driver profile not found");
    return driver.id;
  }

  /**
   * Get or create the driver's unique referral code.
   */
  async getMyReferralCode(driverId: string): Promise<string> {
    const existingReferral = await this.prisma.referral.findFirst({
      where: { referrerId: driverId },
      select: { referralCode: true },
    });

    if (existingReferral) {
      return existingReferral.referralCode;
    }

    const code = await this.generateUniqueCode();

    await this.prisma.referral.create({
      data: {
        referralCode: code,
        referrerId: driverId,
        status: "PENDING",
      },
    });

    return code;
  }

  /**
   * List all referrals made by this driver with their status.
   */
  async getMyReferrals(driverId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: driverId },
      select: {
        id: true,
        referredDriverId: true,
        referredEmail: true,
        referredDriver: {
          select: {
            id: true,
            user: { select: { fullName: true } },
            onboardingCompletedAt: true,
          },
        },
        status: true,
        tripsCompleted: true,
        tripsRequired: true,
        rewardAmount: true,
        rewardPaidAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return referrals.filter((r) => r.referredDriverId || r.referredEmail);
  }

  /**
   * Get referral stats: total earned, pending, active count.
   *
   * Also returns the admin-configured `maxReferrals` so the driver
   * Wallet UI can show progress toward the cap (e.g. "3 / 10 friends").
   */
  async getMyReferralStats(driverId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: driverId },
      select: {
        status: true,
        rewardAmount: true,
        rewardPaidAt: true,
        tripsCompleted: true,
        tripsRequired: true,
        referredDriverId: true,
        referredEmail: true,
      },
    });

    const realReferrals = referrals.filter((r) => r.referredDriverId || r.referredEmail);

    let totalEarned = 0;
    let pendingReward = 0;
    let activeReferrals = 0;
    let completedReferrals = 0;

    for (const r of realReferrals) {
      if (r.rewardPaidAt) {
        totalEarned += r.rewardAmount;
        completedReferrals++;
      } else if (r.status === "TRIPPING" || r.status === "COMPLETED") {
        activeReferrals++;
        if (r.tripsCompleted >= r.tripsRequired) {
          pendingReward += r.rewardAmount;
        }
      } else if (r.status === "REGISTERED" || r.status === "ONBOARDING_COMPLETE") {
        activeReferrals++;
      }
    }

    // Read the admin-configured program config so the UI can show
    // the cap (maxReferrals). Other fields (rewardAmount, tripsRequired,
    // daysToComplete) are exposed via the /referrals/program-config
    // endpoint below — we only add maxReferrals here to avoid
    // duplicating the full config object in stats.
    const config = await this.appSettingService.getReferralProgramSettings();

    return {
      totalEarned,
      pendingReward,
      activeReferrals,
      completedReferrals,
      totalReferrals: realReferrals.length,
      maxReferrals: config.maxReferrals,
    };
  }

  /**
   * Apply a referral code when a new driver signs up.
   *
   * Reads the admin-configured referral program settings
   * (rewardAmount, tripsRequired, maxReferrals) and stamps them onto
   * the new Referral row so the policy at sign-up time is preserved —
   * even if the admin changes the config later, this referral keeps
   * its original terms.
   *
   * Enforces maxReferrals: if the referrer has already hit the cap,
   * the code is rejected with a clear error message.
   */
  async applyReferral(driverId: string, referralCode: string) {
    if (!referralCode) {
      throw new BadRequestException("referralCode is required");
    }

    const referral = await this.prisma.referral.findFirst({
      where: { referralCode, status: "PENDING" },
    });

    if (!referral) {
      throw new NotFoundException("Invalid or expired referral code");
    }

    if (referral.referrerId === driverId) {
      throw new BadRequestException("You cannot use your own referral code");
    }

    const existingLink = await this.prisma.referral.findFirst({
      where: { referredDriverId: driverId },
    });

    if (existingLink) {
      throw new BadRequestException("You already used a referral code");
    }

    // ── Enforce maxReferrals on the referrer ────────────────────
    // Count all referrals made by the referrer that have actually
    // been used (i.e. have a referredDriverId — PENDING rows with
    // no referredDriverId are just the code placeholder and don't
    // count toward the cap).
    const config = await this.appSettingService.getReferralProgramSettings();

    const referrerActiveCount = await this.prisma.referral.count({
      where: {
        referrerId: referral.referrerId,
        referredDriverId: { not: null },
      },
    });

    if (referrerActiveCount >= config.maxReferrals) {
      throw new BadRequestException(
        `This driver has already reached the referral limit (${config.maxReferrals} friends). ` +
        "Please ask them to share their code with someone else, or contact support."
      );
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { user: { select: { email: true } } },
    });

    // ── Stamp the current policy onto the new referral row ─────
    // This freezes the reward amount + trip requirement at the
    // values configured at sign-up time, so admin changes to the
    // program config don't retroactively change pending referrals.
    await this.prisma.referral.create({
      data: {
        referralCode,
        referrerId: referral.referrerId,
        referredDriverId: driverId,
        referredEmail: driver?.user?.email || null,
        status: "REGISTERED",
        tripsRequired: config.tripsRequired,
        rewardAmount: config.rewardAmount,
      },
    });

    return { success: true, message: "Referral code applied successfully" };
  }

  /**
   * Get driver profile info for the wallet page header.
   */
  async getDriverProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        profilePhotoUrl: true,
        selfiePhotoUrl: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    const ratings = await this.prisma.deliveryRating.findMany({
      where: { driverId, stars: { gt: 0 } },
      select: { stars: true },
    });

    const avgRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length) * 10
          ) / 10
        : null;
    const totalRatings = ratings.length;

    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: { driverId },
      select: { deliveryId: true },
    });

    const completedTrips = await this.prisma.deliveryRequest.count({
      where: {
        status: "COMPLETED",
        id: { in: assignments.map((a) => a.deliveryId) },
      },
    });

    return {
      fullName: driver?.user?.fullName || null,
      email: driver?.user?.email || null,
      profilePhotoUrl: driver?.profilePhotoUrl || driver?.selfiePhotoUrl || null,
      avgRating,
      totalRatings,
      completedTrips,
    };
  }

  /**
   * Generate a unique 8-character alphanumeric referral code.
   */
  private async generateUniqueCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    let exists = true;

    while (exists) {
      code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const found = await this.prisma.referral.findFirst({
        where: { referralCode: code },
      });
      exists = !!found;
    }

    return code!;
  }

  /**
   * Get the admin-configured referral program config for the driver
   * Wallet UI. Returns reward amount, required trips, days to complete,
   * and the max referrals cap.
   *
   * This is a thin wrapper around AppSettingService so the driver can
   * fetch the config from the same /api/referrals namespace as the
   * other wallet endpoints, instead of hitting /api/appSettings.
   */
  async getMyReferralProgramConfig() {
    return this.appSettingService.getReferralProgramSettings();
  }
}
