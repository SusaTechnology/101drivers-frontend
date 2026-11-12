// BaDriverController — Nest-side endpoints that complete the Better Auth
// identity with 101 Drivers business context. All of them resolve identity
// from the Better Auth session (cookie OR bearer header) — never from the
// request body. Registered in AuthModule (its collaborators — referral,
// geo, mail, analytics — all live there).

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { BetterAuthService } from "./better-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { SocialDriverSignupService } from "./social-driver-signup.service";
import { SocialDriverSignupDto } from "./dto/socialDriverSignup.dto";
import { MobileOnlySignupGuard } from "../auth/guards/mobile-only-signup.guard";
import {
  RATE_LIMITS,
  RateLimitService,
  assertIpBudget,
} from "../common/rate-limit/rate-limit.service";
import { buildDriverContextPayload } from "./ba-context";

@ApiTags("better-auth")
@Controller("auth/ba")
export class BaDriverController {
  constructor(
    private readonly betterAuth: BetterAuthService,
    private readonly prisma: PrismaService,
    private readonly socialSignup: SocialDriverSignupService,
    private readonly rateLimit: RateLimitService
  ) {}

  /** Public: which social providers are configured (no secrets). */
  @Get("providers")
  @HttpCode(HttpStatus.OK)
  providers(): Record<string, boolean> {
    return this.betterAuth.getEnabledProviders();
  }

  /**
   * The authenticated-user endpoint for Better Auth sessions — returns the
   * legacy UserInfo shape so the frontend cache, DriverRouteGuard and every
   * existing fetch wrapper keep working unchanged.
   */
  @Get("driver-context")
  @HttpCode(HttpStatus.OK)
  async driverContext(@Req() request: Request) {
    const session = await this.betterAuth.getSessionFromRequest(request);
    if (!session) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: session.user.id },
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
    if (!user || !user.isActive) throw new UnauthorizedException();

    const driver = await this.prisma.driver.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        onboardingCompletedAt: true,
        onboardingToken: true,
      },
    });

    return buildDriverContextPayload(user, driver);
  }

  /**
   * Driver application for a social-registered identity: same gates and side
   * effects as the legacy email signup. Mobile-only (same UA policy as the
   * legacy signup route), IP-budgeted, session required.
   */
  @Post("social-driver-signup")
  @HttpCode(HttpStatus.OK)
  @UseGuards(MobileOnlySignupGuard)
  async submitSocialDriverSignup(
    @Body() dto: SocialDriverSignupDto,
    @Req() request: Request
  ) {
    assertIpBudget(request, "social-driver-signup", this.rateLimit, RATE_LIMITS.SIGNUP_SEND_PER_IP);
    const session = await this.betterAuth.getSessionFromRequest(request);
    if (!session) throw new UnauthorizedException();
    return this.socialSignup.signupFromSession(session.user.id, dto, request);
  }
}
