// SocialDriverSignupService — the driver APPLICATION submitted by a person
// whose identity Better Auth already established (social sign-in/up). It
// creates ONLY the business Driver row, under the SAME gates and side effects
// as the legacy email signup (auth.service.signupDriver):
//   California-only ZIP → age 25+ → atomic Driver create (status WAITLISTED)
//   → referral (non-blocking) → service-area verdict (non-blocking)
//   → waitlist confirmation email (non-blocking) → admin surface ping.
// Identity fields (email/name) come from the Better Auth session — NEVER from
// the request body. Authentication ≠ driver approval: the row starts
// WAITLISTED exactly like the email path.

import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { EnumDriverStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralService } from "../referral/referral.service";
import { ServiceAreaService } from "../geo/service-area.service";
import { MailService } from "../common/mail/mail.service";
import { AppEventsService, APP_EVENT } from "../common/appEvents/appEvents.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { SocialDriverSignupDto } from "./dto/socialDriverSignup.dto";
import { assertCaliforniaHomeArea, parseSignupDateOfBirth } from "./ba-driver-gates";
import { buildDriverContextPayload, DriverContextPayload } from "./ba-context";
import type { Request } from "express";
import { clientIpFromRequest } from "../common/rate-limit/rate-limit.service";

@Injectable()
export class SocialDriverSignupService {
  private readonly logger = new Logger(SocialDriverSignupService.name);

  constructor(
    private readonly prisma: PrismaService,
    // forwardRef mirrors auth.service — the ReferralModule dependency chain
    // is circular by design (see auth.service.ts comment).
    @Inject(forwardRef(() => ReferralService))
    private readonly referralService: ReferralService,
    private readonly serviceArea: ServiceAreaService,
    private readonly mailService: MailService,
    private readonly appEvents: AppEventsService,
    private readonly analytics: AnalyticsService
  ) {}

  async signupFromSession(
    baUserId: string,
    dto: SocialDriverSignupDto,
    request: Request
  ): Promise<DriverContextPayload> {
    // ── Business gates FIRST — a rejected applicant leaves no rows behind ──
    assertCaliforniaHomeArea(dto.homeArea);
    const parsedDob = parseSignupDateOfBirth(dto.dateOfBirth);

    const user = await this.prisma.user.findUnique({
      where: { id: baUserId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        roles: true,
        isSuperAdmin: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const existingDriver = await this.prisma.driver.findUnique({
      where: { userId: baUserId },
      select: { id: true },
    });
    if (existingDriver) {
      throw new ConflictException(
        "A driver profile already exists for this account."
      );
    }

    const fullName = dto.fullName.trim();
    const normalizedZip = dto.homeArea.trim();

    // ── Atomic Driver creation (mirrors signupDriver's transaction) ──
    const driver = await this.prisma.$transaction(async (tx) => {
      const created = await tx.driver.create({
        data: {
          status: EnumDriverStatus.WAITLISTED,
          phone: dto.phone?.trim() ?? null,
          dateOfBirth: parsedDob,
          residentialZip: normalizedZip,
          ...(dto.city?.trim()
            ? { preferences: { create: { city: dto.city.trim() } } }
            : {}),
          user: { connect: { id: baUserId } },
        },
        select: { id: true, status: true, onboardingCompletedAt: true, onboardingToken: true },
      });
      return created;
    });

    // ── Referral (non-blocking — must never fail an already-created account) ──
    if (dto.referralCode?.trim()) {
      try {
        await this.referralService.applyReferral(driver.id, dto.referralCode.trim());
        this.logger.log(
          `Referral applied for social-signup driver ${driver.id}`
        );
      } catch (refErr: unknown) {
        this.logger.warn(
          `Referral application failed for social-signup driver ${driver.id}: ${
            refErr instanceof Error ? refErr.message : String(refErr)
          }`
        );
      }
    }

    // ── Service-area verdict (derived badge — never blocks) ──
    try {
      await this.serviceArea.evaluateDriverByZip({
        driverId: driver.id,
        zipRaw: normalizedZip,
        source: "driver signup (social)",
      });
    } catch (areaErr: unknown) {
      this.logger.warn(
        `Service-area evaluation failed for social-signup driver ${driver.id} (non-blocking): ${
          areaErr instanceof Error ? areaErr.message : String(areaErr)
        }`
      );
    }

    // ── Waitlist confirmation email (same copy as the legacy signup) ──
    try {
      await this.mailService.sendMail({
        to: user.email ?? "",
        subject: "Your application to join 101 Drivers has been received",
        text: [
          `Hi ${fullName},`,
          "",
          "Thank you!",
          "Your application to join 101 Drivers has been received.",
          "Your account has been added to the waitlist. We'll review your information and contact you when we're ready to bring on new drivers.",
        ].join("\n"),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto;">
            <h2>Your application to join 101 Drivers has been received</h2>
            <p>Hi ${fullName},</p>
            <p>Thank you! Your application to join 101 Drivers has been received.</p>
            <p>Your account has been added to the waitlist. We'll review your information and contact you when we're ready to bring on new drivers.</p>
          </div>
        `,
      });
    } catch (mailErr: unknown) {
      this.logger.warn(
        `Failed to send social-signup confirmation email: ${
          mailErr instanceof Error ? mailErr.message : String(mailErr)
        }`
      );
    }

    // ── Admin surfaces + analytics (mirror legacy signup) ──
    this.appEvents.emit(APP_EVENT.USER_STATS_CHANGED);
    this.analytics.recordSafe({
      type: "SIGNUP",
      userId: user.id,
      role: "DRIVER",
      ip: clientIpFromRequest(request),
      userAgent: request.headers["user-agent"] ?? null,
    });

    return buildDriverContextPayload(user, driver);
  }
}
