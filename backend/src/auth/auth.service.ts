import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Credentials } from "./Credentials";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { UserInfo } from "./UserInfo";
import { UserService } from "../user/user.service";
import { CustomerService } from "../customer/customer.service";
import { DriverService } from "../driver/driver.service";
import { PrismaService } from "../prisma/prisma.service";
import { SignupDriverDto } from "./dto/SignupDriver.dto";
import { SignupCustomerDto } from "./dto/SignupCustomer.dto";
import { getCookieOptionsFromRequest } from "../common/cors-cookie.util";
import { EmailVerificationService } from "./email-verification/email-verification.service";
import { ForgotPasswordDto } from "./dto/ForgotPassword.dto";
import { ResetPasswordDto } from "./dto/ResetPassword.dto";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { MailService } from "src/common/mail/mail.service";
import {
  EnumCustomerCustomerType,
  EnumCustomerApprovalStatus,
  EnumDriverStatus,
  EnumUserRoles,
  EnumEmailVerificationPurpose,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
} from "@prisma/client";

type AuthValidatedUser = {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  roles: string[];
  isActive: boolean;
};

type VerificationRequiredResult = {
  action: "VERIFICATION_REQUIRED";
  email: string;
  message: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly customerService: CustomerService,
    private readonly driverService: DriverService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly notificationEventEngine: NotificationEventEngine,
    private readonly mailService: MailService,
  ) {}

  private normalizeIdentifier(identifier: string): string {
    return identifier.trim();
  }

  private isEmail(value: string): boolean {
    return value.includes("@");
  }

  /**
   * IMPORTANT:
   * Do not use userService.user(...) here because UserDomain-enriched reads
   * intentionally do not expose password/passwordHash.
   * Auth must fetch its own minimal auth projection directly from Prisma.
   */
  private async findUserByIdentifier(identifier: string) {
    const normalized = this.normalizeIdentifier(identifier);
    const normalizedEmail = normalized.toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        OR: [
          { username: normalized },
          ...(this.isEmail(normalized) ? [{ email: normalizedEmail }] : []),
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        isActive: true,
        fullName: true,
        password: true,
        passwordHash: true,
      },
    });
  }

  private async resolveAuthMeta(
    userId: string,
    roles: string[]
  ): Promise<{
    profileId: string | null;
    customerApprovalStatus: string | null;
    driverStatus: string | null;
    onboardingCompleted: boolean;
    onboardingToken: string | null;
  }> {
    if (
      roles.includes(String(EnumUserRoles.PRIVATE_CUSTOMER)) ||
      roles.includes(String(EnumUserRoles.BUSINESS_CUSTOMER))
    ) {
      const customer = await this.customerService.customer({
        where: { userId },
        select: {
          id: true,
          approvalStatus: true,
        },
      } as any);

      return {
        profileId: customer?.id ?? null,
        customerApprovalStatus: customer?.approvalStatus ?? null,
        driverStatus: null,
        onboardingCompleted: false,
        onboardingToken: null,
      };
    }

    if (roles.includes(String(EnumUserRoles.DRIVER))) {
      const driver = await this.driverService.driver({
        where: { userId },
        select: {
          id: true,
          status: true,
          onboardingCompletedAt: true,
          onboardingToken: true,
        },
      } as any);

      return {
        profileId: driver?.id ?? null,
        customerApprovalStatus: null,
        driverStatus: driver?.status ?? null,
        onboardingCompleted: !!driver?.onboardingCompletedAt,
        onboardingToken: driver?.onboardingToken ?? null,
      };
    }

    return {
      profileId: null,
      customerApprovalStatus: null,
      driverStatus: null,
      onboardingCompleted: false,
      onboardingToken: null,
    };
  }

  async validateUser(
    usernameOrEmail: string,
    password: string
  ): Promise<AuthValidatedUser | null> {
    const user = await this.findUserByIdentifier(usernameOrEmail);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const storedHash = user.passwordHash ?? user.password;

    if (!storedHash) {
      return null;
    }

    const matched = await this.passwordService.compare(password, storedHash);

    if (!matched) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      fullName: (user as any).fullName ?? null,
      roles: [String(user.roles)],
      isActive: user.isActive,
    };
  }

  async login(
    credentials: Credentials,
    request: Request,
    response: Response
  ): Promise<UserInfo> {
    const { username, password } = credentials;

    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException("The passed credentials are incorrect");
    }

    const accessToken = await this.tokenService.createToken({
      id: user.id,
      username: user.username,
      roles: user.roles,
    });

    const refreshToken = await this.tokenService.createRefreshToken({
      id: user.id,
      username: user.username,
      roles: user.roles,
    });

    const authMeta = await this.resolveAuthMeta(user.id, user.roles);
    const cookieOptions = getCookieOptionsFromRequest(request);

    response.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    response.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken,
      refreshToken,
      id: user.id,
      profileId: authMeta.profileId,
      username: user.username,
      email: user.email ?? null,
      fullName: user.fullName ?? null,
      roles: user.roles,
      customerApprovalStatus: authMeta.customerApprovalStatus,
      driverStatus: authMeta.driverStatus,
      onboardingCompleted: authMeta.onboardingCompleted,
      onboardingToken: authMeta.onboardingToken,
      isActive: user.isActive,
    } as UserInfo;
  }

  async refreshToken(request: Request, response: Response): Promise<UserInfo> {
    const refreshToken = request.cookies?.["refreshToken"];

    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      if (payload?.type !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const user = await this.userService.user({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          email: true,
          roles: true,
          isActive: true,
          fullName: true,
        },
      } as any);

      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      const roles = [String(user.roles)];
      const authMeta = await this.resolveAuthMeta(user.id, roles);

      const newAccessToken = await this.tokenService.createToken({
        id: user.id,
        username: user.username,
        roles,
      });

      const newRefreshToken = await this.tokenService.createRefreshToken({
        id: user.id,
        username: user.username,
        roles,
      });

      const cookieOptions = getCookieOptionsFromRequest(request);

      response.cookie("accessToken", newAccessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      });

      response.cookie("refreshToken", newRefreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        id: user.id,
        profileId: authMeta.profileId,
        username: user.username,
        email: (user as any).email ?? null,
        fullName: (user as any).fullName ?? null,
        roles,
        customerApprovalStatus: authMeta.customerApprovalStatus,
        driverStatus: authMeta.driverStatus,
        onboardingCompleted: authMeta.onboardingCompleted,
        onboardingToken: authMeta.onboardingToken,
        isActive: user.isActive,
      } as UserInfo;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  async logout(
    request: Request,
    response: Response
  ): Promise<{ success: boolean; message: string }> {
    const base = getCookieOptionsFromRequest(request);

    const host = (request.hostname || "").toLowerCase();
    const root = (process.env.ROOT_DOMAIN || "techbee.et").toLowerCase();

    const candidates = Array.from(
      new Set<string | undefined>([
        base.domain,
        `.${root}`,
        root,
        host || undefined,
        undefined,
      ])
    );

    const clear = (name: string, domain?: string) =>
      response.clearCookie(name, {
        ...base,
        domain,
        maxAge: 0,
        expires: new Date(0),
        path: "/",
      });

    for (const d of candidates) {
      clear("accessToken", d);
      clear("refreshToken", d);
    }

    response.setHeader("Cache-Control", "no-store");

    return {
      success: true,
      message: "Logged out successfully.",
    };
  }

  async signupDriver(
    dto: SignupDriverDto,
    request: Request,
    response: Response
  ): Promise<UserInfo | VerificationRequiredResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Validate driver age (must be 25+) before anything else
    this.validateDriverAge(dto.dateOfBirth);

    await this.ensureEmailDoesNotExist(normalizedEmail);

    if (!dto.verificationToken) {
      await this.emailVerificationService.requestVerification(
        normalizedEmail,
        dto.fullName,
        "DRIVER"
      );

      return {
        action: "VERIFICATION_REQUIRED",
        email: normalizedEmail,
        message: "Verification OTP sent to your email",
      };
    }

    await this.emailVerificationService.consumeTokenForEmail(
      normalizedEmail,
      dto.verificationToken,
      EnumEmailVerificationPurpose.SIGNUP
    );

    const hashed = await this.passwordService.hash(dto.password);

    // Parse date of birth from MM/DD/YYYY (do this before the transaction
    // so a bad date format throws BEFORE we create any rows).
    const [dobMonth, dobDay, dobYear] = dto.dateOfBirth.split("/");
    const parsedDob = new Date(parseInt(dobYear), parseInt(dobMonth) - 1, parseInt(dobDay));

    // ─── Atomic User+Driver creation ───────────────────────────────────
    // Wrap both writes in a $transaction so a failure in the Driver create
    // (policy check, DB hiccup, etc.) rolls back the User row. Previously
    // these were two independent calls — if createDriver threw, the User row
    // was left behind as an orphan with no Driver record, blocking the
    // applicant from retrying with the same email.
    //
    // We bypass UserService.createUser / DriverService.createDriver here
    // because those service wrappers don't accept a transaction client.
    // The policy checks they perform (DriverPolicyService.beforeCreate) are
    // all validations on the dto data (required fields, age, etc.) that we've
    // already validated above. The UserPolicyService.beforeCreate checks are
    // also skipped — username uniqueness is derived from email + a timestamp
    // suffix (generateUsernameFromEmail), so collisions are astronomically
    // unlikely.
    //
    // Referral code application + confirmation email stay OUTSIDE the
    // transaction — they're non-blocking best-effort, and putting them inside
    // would needlessly hold the transaction open during email send.
    const { userId, username, userRoles, driverId } = await this.prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: this.generateUsernameFromEmail(normalizedEmail),
            email: normalizedEmail,
            password: hashed,
            roles: EnumUserRoles.DRIVER,
            fullName: dto.fullName,
            phone: dto.phone ?? null,
            isActive: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, username: true, roles: true },
        });

        const createdDriver = await tx.driver.create({
          data: {
            status: EnumDriverStatus.WAITLISTED,
            phone: dto.phone ?? null,
            profilePhotoUrl: dto.profilePhotoUrl ?? null,
            selfiePhotoUrl: dto.selfiePhotoUrl ?? null,
            dateOfBirth: parsedDob,
            user: { connect: { id: createdUser.id } },
            agreementAcceptedAt: dto.agreementAcceptedAt ? new Date(dto.agreementAcceptedAt) : null,

            ...(this.buildDriverPreferenceCreate(dto)),
            ...(this.buildDriverAlertsCreate(dto)),
            ...(this.buildDriverDistrictsCreate(dto)),
          },
          select: { id: true },
        });

        return {
          userId: createdUser.id,
          username: createdUser.username,
          userRoles: createdUser.roles,
          driverId: createdDriver.id,
        };
      },
    );

    // ── Apply referral code if provided ──────────────────────
    // Outside the transaction — non-blocking. If the referral is invalid,
    // expired, or self-referral, we just skip it. The driver account is
    // already created at this point.
    if (dto.referralCode && driverId) {
      try {
        const existingRef = await this.prisma.referral.findFirst({
          where: { referralCode: dto.referralCode, status: "PENDING" },
          select: { referrerId: true },
        });
        if (existingRef) {
          await this.prisma.referral.create({
            data: {
              referralCode: dto.referralCode,
              referrer: { connect: { id: existingRef.referrerId } },
              referredDriver: { connect: { id: driverId } },
              referredEmail: normalizedEmail,
              status: "REGISTERED",
            },
          });
          this.logger.log(`Referral ${dto.referralCode} applied for new driver ${driverId}`);
        } else {
          this.logger.warn(`Referral code ${dto.referralCode} not found or expired, skipping for driver ${driverId}`);
        }
      } catch (refErr: any) {
        // Non-blocking: invalid/expired/self-referral just gets skipped
        this.logger.warn(`Referral application failed for driver ${driverId}: ${refErr.message}`);
      }
    }

    // Send confirmation email to driver after successful sign-up
    // Outside the transaction — non-blocking. If email send fails, the
    // driver account is still created; we just log the error.
    try {
      await this.mailService.sendMail({
        to: normalizedEmail,
        subject: "Your application to join 101 Drivers has been received",
        text: [
          `Hi ${dto.fullName},`,
          "",
          "Thank you!",
          "Your application to join 101 Drivers has been received.",
          "Your account has been added to the waitlist. We'll review your information and contact you when we're ready to bring on new drivers.",
        ].join("\n"),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto;">
            <h2>Your application to join 101 Drivers has been received</h2>
            <p>Hi ${dto.fullName},</p>
            <p>Thank you! Your application to join 101 Drivers has been received.</p>
            <p>Your account has been added to the waitlist. We'll review your information and contact you when we're ready to bring on new drivers.</p>
          </div>
        `,
      });
    } catch (notificationError) {
      this.logger.error(
        `Failed to send driver signup confirmation email: ${
          notificationError instanceof Error ? notificationError.message : String(notificationError)
        }`,
        notificationError instanceof Error ? notificationError.stack : undefined,
      );
    }

    return this.issueToken(
      userId,
      username,
      normalizedEmail,
      userRoles,
      request,
      response,
      dto.fullName
    );
  }

  private buildDriverPreferenceCreate(dto: SignupDriverDto) {
    const city = dto.city?.trim() ?? null;
    const radiusMiles = dto.radiusMiles ?? null;

    if (!city && radiusMiles == null) {
      return {};
    }

    return {
      preferences: {
        create: {
          city,
          radiusMiles,
        },
      },
    };
  }

  private buildDriverAlertsCreate(dto: SignupDriverDto) {
    return {
      alerts: {
        create: {
          enabled: dto.alertsEnabled ?? true,
          emailEnabled: dto.emailAlertsEnabled ?? true,
          smsEnabled: dto.smsAlertsEnabled ?? false,
        },
      },
    };
  }

  private buildDriverDistrictsCreate(dto: SignupDriverDto) {
    const districtIds = (dto.districtIds ?? [])
      .map((id) => id?.trim())
      .filter((id): id is string => !!id);

    if (!districtIds.length) {
      return {};
    }

    return {
      districts: {
        create: districtIds.map((districtId) => ({
          district: {
            connect: { id: districtId },
          },
        })),
      },
    };
  }

  async signupPrivateCustomer(
    dto: SignupCustomerDto,
    request: Request,
    response: Response
  ): Promise<UserInfo | VerificationRequiredResult> {
    // ─── Private (individual) customer signup ─────────────────────────
    // Mirrors signupBusinessCustomer but with key differences:
    //   • No businessName / businessPlaceId required
    //   • No businessPlaceId uniqueness check (private customers don't have one)
    //   • roles: PRIVATE_CUSTOMER (not BUSINESS_CUSTOMER)
    //   • customerType: PRIVATE (not BUSINESS)
    //   • approvalStatus: APPROVED immediately (private customers don't need
    //     admin approval — the DealerSignIn flow already skips approval
    //     checks for PRIVATE_CUSTOMER role)
    //   • OTP purpose: "PRIVATE_CUSTOMER"
    //
    // The same SignupCustomerDto is used — business-specific fields are
    // all optional and simply ignored here.

    const normalizedEmail = dto.email.trim().toLowerCase();

    // Pre-flight email uniqueness check (same as business signup).
    await this.ensureEmailDoesNotExist(normalizedEmail);

    if (!dto.verificationToken) {
      await this.emailVerificationService.requestVerification(
        normalizedEmail,
        dto.contactName || dto.fullName,
        "PRIVATE_CUSTOMER"
      );

      return {
        action: "VERIFICATION_REQUIRED",
        email: normalizedEmail,
        message: "Verification OTP sent to your email",
      };
    }

    await this.emailVerificationService.consumeTokenForEmail(
      normalizedEmail,
      dto.verificationToken,
      EnumEmailVerificationPurpose.SIGNUP
    );

    const hashed = await this.passwordService.hash(dto.password);

    const userPhone = dto.contactPhone ?? dto.phone ?? null;

    // Atomic User+Customer creation — same transaction pattern as business.
    const { userId, username, userRoles } = await this.prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: this.generateUsernameFromEmail(normalizedEmail),
            email: normalizedEmail,
            password: hashed,
            roles: EnumUserRoles.PRIVATE_CUSTOMER,
            fullName: dto.fullName,
            phone: userPhone,
            isActive: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, username: true, roles: true },
        });

        await tx.customer.create({
          data: {
            customerType: EnumCustomerCustomerType.PRIVATE,
            contactName: dto.contactName,
            contactEmail: normalizedEmail,
            contactPhone: dto.contactPhone ?? dto.phone ?? null,
            phone: dto.phone ?? null,
            // Private customers are auto-approved — no admin review needed.
            approvalStatus: EnumCustomerApprovalStatus.APPROVED,
            approvedAt: new Date(),
            user: { connect: { id: createdUser.id } },
          },
          select: { id: true },
        });

        return {
          userId: createdUser.id,
          username: createdUser.username,
          userRoles: createdUser.roles,
        };
      },
    );

    return this.issueToken(
      userId,
      username,
      normalizedEmail,
      userRoles,
      request,
      response,
      dto.fullName
    );
  }

  async signupBusinessCustomer(
    dto: SignupCustomerDto,
    request: Request,
    response: Response
  ): Promise<UserInfo | VerificationRequiredResult> {
    if (!dto.businessName) {
      throw new BadRequestException(
        "businessName is required for business customer signup"
      );
    }

    if (!dto.businessPlaceId) {
      throw new BadRequestException(
        "businessPlaceId is required for business customer signup"
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    // ─── Pre-flight uniqueness checks ─────────────────────────────────
    // Run BOTH the email and businessPlaceId uniqueness checks BEFORE the
    // OTP-send step. Previously, businessPlaceId uniqueness was only enforced
    // by the DB constraint inside CustomerService.createCustomer — which ran
    // AFTER the User row had already been created. A duplicate business name
    // therefore orphaned the User row, and the dealer's next retry would 409
    // on "Email already exists" (the orphaned User row blocking the retry).
    //
    // Pre-checking here means the dealer gets a clear, recognizable error
    // BEFORE receiving an OTP, and no User row is created if the business is
    // already registered.
    await this.ensureEmailDoesNotExist(normalizedEmail);
    await this.ensureBusinessPlaceIdDoesNotExist(dto.businessPlaceId);

    if (!dto.verificationToken) {
      await this.emailVerificationService.requestVerification(
        normalizedEmail,
        dto.contactName || dto.fullName,
        "BUSINESS_CUSTOMER"
      );

      return {
        action: "VERIFICATION_REQUIRED",
        email: normalizedEmail,
        message: "Verification OTP sent to your email",
      };
    }

    await this.emailVerificationService.consumeTokenForEmail(
      normalizedEmail,
      dto.verificationToken,
      EnumEmailVerificationPurpose.SIGNUP
    );

    const hashed = await this.passwordService.hash(dto.password);

    // ─── Atomic User+Customer creation ────────────────────────────────
    // Wrap both writes in a $transaction so a failure in the Customer create
    // (e.g. a last-millisecond businessPlaceId race) rolls back the User row.
    // Previously these were two independent writes — if Customer create threw
    // (unique constraint, policy check, DB hiccup), the User row was left
    // behind as an orphan with no Customer record, which surfaced in the
    // admin UI as a "PENDING" user with no phone numbers and no business info.
    //
    // We bypass UserService.createUser / CustomerService.createCustomer here
    // because those service wrappers don't accept a transaction client. The
    // policy checks they perform (CustomerPolicyService.beforeCreate) all run
    // against data we've already validated above (businessPlaceId uniqueness,
    // required BUSINESS fields, approval fields), so skipping them is safe.
    // The UserPolicyService.beforeCreate checks are also skipped — they enforce
    // username uniqueness, which is derived from email + a timestamp suffix
    // (generateUsernameFromEmail), so collisions are astronomically unlikely.
    //
    // Also populate user.phone from contactPhone ?? phone — the DealerSignupForm
    // sends contactPhone but never sends `phone`, so previously every business
    // User row had phone=null. The admin user-detail page falls back through
    // user.phone → driver.phone → customer.businessPhone → customer.contactPhone
    // → customer.phone; for an orphaned User (no Customer), this left the
    // admin with no phone number at all. Populating user.phone here ensures
    // the admin can always reach the dealer even if the Customer row is later
    // deleted or never created.
    const userPhone = dto.contactPhone ?? dto.phone ?? null;

    const { userId, username, userRoles } = await this.prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: this.generateUsernameFromEmail(normalizedEmail),
            email: normalizedEmail,
            password: hashed,
            roles: EnumUserRoles.BUSINESS_CUSTOMER,
            fullName: dto.fullName,
            phone: userPhone,
            isActive: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, username: true, roles: true },
        });

        await tx.customer.create({
          data: {
            customerType: EnumCustomerCustomerType.BUSINESS,
            contactName: dto.contactName,
            contactEmail: normalizedEmail,
            contactPhone: dto.contactPhone ?? dto.phone ?? null,
            phone: dto.phone ?? null,
            businessName: dto.businessName,
            businessPlaceId: dto.businessPlaceId,
            businessAddress: dto.businessAddress ?? null,
            businessPhone: dto.businessPhone ?? null,
            businessWebsite: dto.businessWebsite ?? null,
            user: { connect: { id: createdUser.id } },
          },
          select: { id: true },
        });

        return {
          userId: createdUser.id,
          username: createdUser.username,
          userRoles: createdUser.roles,
        };
      },
    );

    return this.issueToken(
      userId,
      username,
      normalizedEmail,
      userRoles,
      request,
      response,
      dto.fullName
    );
  }

  /**
   * Pre-flight check: ensure no Customer row already uses this businessPlaceId.
   * Throws a BadRequestException with a recognizable, frontend-detectable
   * message so the DealerSignupForm can show an inline error under the
   * business-search field instead of a generic toast.
   *
   * Mirrors ensureEmailDoesNotExist in shape. We use BadRequestException (not
   * the 409 AppException that CustomerPolicyService throws) so the message
   * arrives as a plain string the frontend can match on — consistent with how
   * the email-exists error is reported.
   */
  private async ensureBusinessPlaceIdDoesNotExist(businessPlaceId: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { businessPlaceId },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        "This business is already registered. If you are the owner, contact support to claim this account."
      );
    }
  }

  /**
   * Lightweight OTP check that does NOT consume the token.
   * Used by the dealer signup form for live verification feedback
   * (auto-verifies as soon as the user types the 6th digit).
   * The actual token consumption happens later via consumeTokenForEmail
   * inside signupBusinessCustomer when the form is finally submitted.
   */
  async verifyOtp(
    email: string,
    verificationToken: string
  ): Promise<{ verified: boolean }> {
    const verified = await this.emailVerificationService.checkTokenForEmail(
      email,
      verificationToken,
      EnumEmailVerificationPurpose.SIGNUP
    );
    return { verified };
  }

  async forgotPassword(
    dto: ForgotPasswordDto
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.userService.user({
      where: { email: normalizedEmail } as any,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    } as any);

    if (!user || !user.isActive) {
      return {
        success: true,
        message:
          "If an account with that email exists, a reset code has been sent.",
      };
    }

    await this.emailVerificationService.requestVerification(
      normalizedEmail,
      (user as any).fullName ?? null,
      "PASSWORD_RESET"
    );

    return {
      success: true,
      message:
        "If an account with that email exists, a reset code has been sent.",
    };
  }

  async resetPassword(
    dto: ResetPasswordDto
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.userService.user({
      where: { email: normalizedEmail } as any,
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    } as any);

    if (!user || !user.isActive) {
      throw new BadRequestException("Invalid reset request");
    }

    await this.emailVerificationService.consumeTokenForEmail(
      normalizedEmail,
      dto.verificationToken,
      EnumEmailVerificationPurpose.PASSWORD_RESET
    );

    const hashed = await this.passwordService.hash(dto.newPassword);

    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        password: hashed,
      },
    } as any);

    return {
      success: true,
      message: "Password reset successfully",
    };
  }

  private async issueToken(
    userId: string,
    username: string,
    email: string | null,
    roles: EnumUserRoles,
    request: Request,
    response: Response,
    fullName?: string | null,
  ): Promise<UserInfo> {
    const roleList = [String(roles)];
    const authMeta = await this.resolveAuthMeta(userId, roleList);

    const accessToken = await this.tokenService.createToken({
      id: userId,
      username,
      roles: roleList,
    });

    const refreshToken = await this.tokenService.createRefreshToken({
      id: userId,
      username,
      roles: roleList,
    });

    const cookieOptions = getCookieOptionsFromRequest(request);

    response.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    response.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken,
      refreshToken,
      id: userId,
      profileId: authMeta.profileId,
      username,
      email,
      fullName: fullName ?? null,
      roles: roleList,
      customerApprovalStatus: authMeta.customerApprovalStatus,
      driverStatus: authMeta.driverStatus,
      onboardingCompleted: authMeta.onboardingCompleted,
      onboardingToken: authMeta.onboardingToken,
      isActive: true,
    } as UserInfo;
  }

  private validateDriverAge(dateOfBirth: string): void {
    const [month, day, year] = dateOfBirth.split("/");
    const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 25) {
      throw new BadRequestException("Driver must be at least 25 years old");
    }
  }

  private generateUsernameFromEmail(email: string): string {
    const base = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");
    return `${base}_${Date.now()}`;
  }

  private async ensureEmailDoesNotExist(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const byEmail = await this.userService.user({
      where: { email: normalizedEmail } as any,
    });

    if (byEmail) {
      throw new BadRequestException("Email already exists");
    }
  }
}