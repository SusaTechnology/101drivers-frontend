import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      totalEarned,
      pendingReward,
      activeReferrals,
      completedReferrals,
      totalReferrals: realReferrals.length,
    };
  }

  /**
   * Apply a referral code when a new driver signs up.
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

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { user: { select: { email: true } } },
    });

    await this.prisma.referral.create({
      data: {
        referralCode,
        referrerId: referral.referrerId,
        referredDriverId: driverId,
        referredEmail: driver?.user?.email || null,
        status: "REGISTERED",
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
      const found = await this.prisma.referral.findUnique({
        where: { referralCode: code },
      });
      exists = !!found;
    }

    return code!;
  }
}
