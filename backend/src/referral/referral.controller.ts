import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { Response } from "express";

@swagger.ApiTags("referrals")
@common.Controller("referrals")
export class ReferralController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the driver record from the authenticated user's JWT payload.
   */
  private async resolveDriverId(req: any): Promise<string> {
    const userId = (req as any).user?.id;
    if (!userId) throw new common.UnauthorizedException("Not authenticated");

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) throw new common.NotFoundException("Driver profile not found");
    return driver.id;
  }

  /**
   * GET /referrals/my-referral-code
   * Get or create the driver's unique referral code.
   */
  @common.Get("my-referral-code")
  @swagger.ApiOkResponse({ description: "Driver's referral code" })
  async getMyReferralCode(@common.Req() req: any, @common.Res() res: Response): Promise<void> {
    const driverId = await this.resolveDriverId(req);

    const existingReferral = await this.prisma.referral.findFirst({
      where: { referrerId: driverId },
      select: { referralCode: true },
    });

    if (existingReferral) {
      res.json({ referralCode: existingReferral.referralCode });
      return;
    }

    const code = await this.generateUniqueCode();

    await this.prisma.referral.create({
      data: {
        referralCode: code,
        referrerId: driverId,
        status: "PENDING",
      },
    });

    res.json({ referralCode: code });
  }

  /**
   * GET /referrals/my-referrals
   * List all referrals made by this driver with their status.
   */
  @common.Get("my-referrals")
  @swagger.ApiOkResponse({ description: "List of referrals" })
  async getMyReferrals(@common.Req() req: any, @common.Res() res: Response): Promise<void> {
    const driverId = await this.resolveDriverId(req);

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: driverId },
      select: {
        id: true,
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

    const realReferrals = referrals.filter(
      (r) => r.referredDriverId || r.referredEmail
    );

    res.json({ referrals: realReferrals });
  }

  /**
   * GET /referrals/my-stats
   * Get referral stats: total earned, pending, active count.
   */
  @common.Get("my-stats")
  @swagger.ApiOkResponse({ description: "Referral stats" })
  async getMyReferralStats(@common.Req() req: any, @common.Res() res: Response): Promise<void> {
    const driverId = await this.resolveDriverId(req);

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: driverId },
      select: {
        status: true,
        rewardAmount: true,
        rewardPaidAt: true,
        tripsCompleted: true,
        tripsRequired: true,
        referredDriverId: true,
      },
    });

    const realReferrals = referrals.filter(
      (r) => r.referredDriverId || r.referredEmail
    );

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

    res.json({
      totalEarned,
      pendingReward,
      activeReferrals,
      completedReferrals,
      totalReferrals: realReferrals.length,
    });
  }

  /**
   * POST /referrals/apply
   * Called when a new driver signs up with a referral code.
   */
  @common.Post("apply")
  @swagger.ApiOkResponse({ description: "Referral applied" })
  async applyReferral(
    @common.Body() body: { referralCode: string },
    @common.Req() req: any,
  ): Promise<any> {
    const driverId = await this.resolveDriverId(req);

    const { referralCode } = body;
    if (!referralCode) {
      throw new common.BadRequestException("referralCode is required");
    }

    const referral = await this.prisma.referral.findFirst({
      where: { referralCode, status: "PENDING" },
    });

    if (!referral) {
      throw new common.NotFoundException("Invalid or expired referral code");
    }

    if (referral.referrerId === driverId) {
      throw new common.BadRequestException("You cannot use your own referral code");
    }

    const existingLink = await this.prisma.referral.findFirst({
      where: { referredDriverId: driverId },
    });

    if (existingLink) {
      throw new common.BadRequestException("You already used a referral code");
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
   * GET /referrals/driver-profile
   * Get driver profile info for the wallet page header.
   */
  @common.Get("driver-profile")
  @swagger.ApiOkResponse({ description: "Driver profile summary" })
  async getDriverProfile(@common.Req() req: any, @common.Res() res: Response): Promise<void> {
    const driverId = await this.resolveDriverId(req);

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
        ? Math.round((ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length) * 10) / 10
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

    res.json({
      fullName: driver?.user?.fullName || null,
      email: driver?.user?.email || null,
      profilePhotoUrl: driver?.profilePhotoUrl || driver?.selfiePhotoUrl || null,
      avgRating,
      totalRatings,
      completedTrips,
    });
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
