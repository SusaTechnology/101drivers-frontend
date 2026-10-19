import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { Credentials } from "./Credentials";
import { UserInfo } from "./UserInfo";
import { SignupDriverDto } from "./dto/SignupDriver.dto";
import { SignupCustomerDto } from "./dto/SignupCustomer.dto";
import { JwtAuthGuard } from "./jwt/jwtAuth.guard";
import { ForgotPasswordDto } from "./dto/ForgotPassword.dto";
import { ResetPasswordDto } from "./dto/ResetPassword.dto";
import { VerifyOtpDto } from "./dto/VerifyOtp.dto";
import {
  RATE_LIMITS,
  RateLimitService,
  assertIpBudget,
} from "../common/rate-limit/rate-limit.service";
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: RateLimitService
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: Credentials,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserInfo> {
    return this.authService.login(body, request, response);
  }

  @Get("refresh-token")
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserInfo> {
    return this.authService.refreshToken(request, response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.logout(request, response);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() request: Request) {
    return request.user;
  }

  @Post("signup/driver")
  @HttpCode(HttpStatus.OK)
  async signupDriver(
    @Body() body: SignupDriverDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    // Per-IP budget on the SEND path only (no verificationToken = an OTP
    // email is about to go out). OTP-typing/verify calls are never limited.
    if (!body.verificationToken) {
      assertIpBudget(request, "signup-send", this.rateLimit, RATE_LIMITS.SIGNUP_SEND_PER_IP);
    }
    return this.authService.signupDriver(body, request, response);
  }

  /**
   * Public field-level ZIP service-area check for the driver signup form.
   *
   * GET /api/auth/public/validate-zip/90012 (no auth — mirrors the
   * referral public resolve endpoint pattern).
   *
   * Returns 200 always with a structured verdict the form renders live:
   *   { valid: true,  zip, state: "CA", reason: null,
   *     message: "In California — we serve this area." }
   *   { valid: false, zip, state: null, reason: "OUT_OF_STATE"|"INVALID_FORMAT",
   *     message: "Not in California — ..." }
   *
   * Same rule as the signupDriver hard guard (single source of truth in
   * AuthService.evaluateCaliforniaHomeArea) — the form can never show
   * green for a ZIP the backend would reject. The California gate is NOT
   * changed by the service-area feature: the LA-metro polygon only
   * derives the admin badge AFTER a California account exists.
   */
  @Get("public/validate-zip/:zip")
  @HttpCode(HttpStatus.OK)
  async validateSignupZip(@Param("zip") zip: string) {
    return this.authService.validateHomeAreaZip(zip);
  }

  @Post("signup/customer/private")
  @HttpCode(HttpStatus.OK)
  async signupPrivateCustomer(
    @Body() body: SignupCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    // Send path only — same contract as signup/driver above.
    if (!(body as { verificationToken?: string }).verificationToken) {
      assertIpBudget(request, "signup-send", this.rateLimit, RATE_LIMITS.SIGNUP_SEND_PER_IP);
    }
    return this.authService.signupPrivateCustomer(body, request, response);
  }

  /**
   * Resend OTP for a pending private customer signup.
   * Called when a user tries to sign up with an email that has a pending
   * (unverified) registration and chooses "Verify the old signup".
   *
   * Body: { email: string }
   * Returns: { action: "VERIFICATION_REQUIRED", email, message }
   */
  @Post("signup/customer/private/resend-otp")
  @HttpCode(HttpStatus.OK)
  async resendPrivateCustomerOtp(
    @Body() body: { email: string },
    @Req() request: Request
  ): Promise<any> {
    assertIpBudget(request, "otp-resend", this.rateLimit, RATE_LIMITS.RESEND_PER_IP);
    return this.authService.resendPrivateCustomerOtp(body.email);
  }

  @Post("signup/customer/business")
  @HttpCode(HttpStatus.OK)
  async signupBusinessCustomer(
    @Body() body: SignupCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    // Send path only — same contract as signup/driver above.
    if (!(body as { verificationToken?: string }).verificationToken) {
      assertIpBudget(request, "signup-send", this.rateLimit, RATE_LIMITS.SIGNUP_SEND_PER_IP);
    }
    return this.authService.signupBusinessCustomer(body, request, response);
  }

  /**
   * Lightweight OTP verification endpoint.
   * Checks whether the 6-digit code is valid for the given email
   * WITHOUT consuming the token. Used by the dealer signup form for
   * live verification feedback (auto-verifies as the user types the
   * 6th digit). The actual token consumption happens inside
   * signupBusinessCustomer when the form is finally submitted.
   */
  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto): Promise<{ verified: boolean }> {
    return this.authService.verifyOtp(body.email, body.verificationToken);
  }
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
    @Req() request: Request
  ): Promise<{ success: boolean; message: string }> {
    assertIpBudget(request, "forgot-password", this.rateLimit, RATE_LIMITS.PASSWORD_RESET_PER_IP);
    return this.authService.forgotPassword(body);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: ResetPasswordDto
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.resetPassword(body);
  }
}