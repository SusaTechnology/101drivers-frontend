import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
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
import { ReferralService } from "../referral/referral.service";
import {
  EnumCustomerCustomerType,
  EnumDriverStatus,
  EnumUserRoles,
  EnumEmailVerificationPurpose,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  EnumCustomerApprovalStatus,
  EnumCustomerPricingModeOverride,
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
} from "@prisma/client";

// Sliding-session refresh-token cookie lifetime. Every successful refresh
// re-mints the refresh token AND extends this cookie, so the session only
// ends after this long with ZERO refreshes (i.e. the user fully away) or an
// explicit logout. Active users are never interrupted. Must match (or be
// under) JWT_REFRESH_EXPIRES_IN — the code default for that is now 30d too.
const REFRESH_COOKIE_MAX_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type AuthValidatedUser = {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  roles: string[];
  isActive: boolean;
  isSuperAdmin: boolean;
};

type VerificationRequiredResult = {
  action: "VERIFICATION_REQUIRED";
  email: string;
  message: string;
};

/**
 * Returned when a user tries to sign up with an email that has a pending
 * (unverified) signup. The frontend shows a dialog: "You started a
 * registration with this email but didn't verify it. Verify now or use
 * a different email?"
 */
type PendingVerificationResult = {
  action: "PENDING_VERIFICATION";
  email: string;
  createdAt: Date;
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
    // ReferralService is injected via forwardRef because AuthModule
    // and ReferralModule form a circular dependency chain (ReferralModule
    // imports DriverPayoutModule which imports DeliveryLogisticsModule
    // which imports ReferralModule; AuthModule imports ReferralModule).
    // forwardRef breaks the cycle at the TS-level so DI can resolve it
    // at runtime.
    @Inject(forwardRef(() => ReferralService))
    private readonly referralService: ReferralService,
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
        isSuperAdmin: true,
        emailVerifiedAt: true,
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

    // Admin lifecycle gate: an admin whose invite hasn't been accepted
    // (email unverified) can NEVER sign in — whether the invite is still
    // pending or already expired. The message distinguishes the two so
    // the admin knows the fix (use the invite link / ask for a resend).
    // This runs before the password check: pending invites have no
    // password at all, so post-password messaging could never fire for
    // them.
    if (String(user.roles) === "ADMIN" && !user.emailVerifiedAt) {
      const liveInvite = await this.prisma.emailVerificationToken.findFirst({
        where: {
          email: (user.email ?? "").toLowerCase(),
          purpose: EnumEmailVerificationPurpose.ADMIN_INVITE,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      throw new UnauthorizedException(
        liveInvite
          ? "This admin account hasn't been activated yet — the invitation is still pending. Use the invite link from your email or ask an administrator to resend it."
          : "This admin account's invitation has expired — ask an administrator to resend the invite."
      );
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
      isSuperAdmin: user.isSuperAdmin === true,
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
      maxAge: REFRESH_COOKIE_MAX_MS,
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
      isSuperAdmin: user.isSuperAdmin === true,
    } as UserInfo;
  }

  async refreshToken(request: Request, response: Response): Promise<UserInfo> {
    // Credential resolution: the httpOnly cookie is preferred, but browsers
    // that block cross-site cookies (iOS standalone PWAs, Safari ITP, Chrome
    // with third-party cookies disabled) never store or send it — for those
    // clients the web app sends the refresh token in the `x-refresh-token`
    // header instead. Either credential alone is sufficient.
    const cookieToken = request.cookies?.["refreshToken"];
    const headerToken = request.headers?.["x-refresh-token"];
    const refreshToken =
      (typeof cookieToken === "string" && cookieToken) ||
      (typeof headerToken === "string" && headerToken) ||
      undefined;

    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    // Verify the JWT and translate ONLY verification failures (bad signature,
    // expired token, malformed payload) into 401. Everything after this block
    // deliberately sits OUTSIDE the catch: a transient infrastructure error
    // (DB hiccup, brief restart during a deploy) used to be swallowed here and
    // re-thrown as 401 "Invalid or expired refresh token", which the client
    // treats as "session truly expired" and force-logs the user out. Infra
    // errors must surface as 5xx so the client keeps the session and retries.
    let payload: any;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

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
        isSuperAdmin: true,
        emailVerifiedAt: true,
        fullName: true,
      },
    } as any);

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or inactive");
    }

    // Same admin lifecycle gate as login — a never-activated admin
    // (invite pending or expired) cannot hold a live session either.
    if (String(user.roles) === "ADMIN" && !user.emailVerifiedAt) {
      throw new UnauthorizedException(
        "This admin account hasn't been activated yet — sign-in is blocked until the invite is accepted"
      );
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

    // Sliding session: every successful refresh re-mints the refresh token
    // and extends its cookie. 30 days of inactivity ends the session; active
    // users are never interrupted.
    response.cookie("refreshToken", newRefreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_COOKIE_MAX_MS,
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
      isSuperAdmin: (user as any).isSuperAdmin === true,
    } as UserInfo;
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

    // ─── California-only driver onboarding ───────────────────────────
    // 101 Drivers operates exclusively in California. Reject out-of-state
    // ZIPs FIRST — before the OTP request (call 1) and before any User/
    // Driver row can be created (call 2) — so an out-of-state applicant
    // never leaves a record behind. Mirrors the frontend check in
    // driverOnboarding.tsx. Every California ZIP falls in the contiguous
    // range 90001–96199 (the 9xx block below 97000; Oregon starts at
    // 97000), so a range check needs no ZIP database.
    this.assertCaliforniaHomeArea(dto.homeArea);

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
            // Signup form collects a mandatory 5-digit "Home ZIP Code" that
            // was previously dropped (field never declared on the DTO), so
            // admins saw no ZIP until the driver completed onboarding. Save
            // it as residentialZip — onboarding-complete overwrites it later
            // with the verified value.
            residentialZip: this.normalizeSignupZip(dto.homeArea),
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
    // Outside the transaction — non-blocking. Delegates to
    // ReferralService.applyReferral which:
    //   - Validates the code exists + is PENDING
    //   - Checks for self-referral + already-used-code
    //   - Reads the live program config + validates program is active
    //   - Validates the current date is inside the calendar window
    //   - SNAPS the policy onto the new Referral row (rewardTrigger,
    //     requiredDeliveries, expiresAt, referredGetsReward,
    //     referredRewardAmount) so admin changes don't retroactively
    //     affect pending referrals
    //
    // If applyReferral throws (invalid code, paused, out-of-window,
    // self-referral, already-used), we just log + skip. The driver
    // account is already created at this point — referral failure
    // must NOT block signup.
    if (dto.referralCode && driverId) {
      try {
        await this.referralService.applyReferral(driverId, dto.referralCode);
        this.logger.log(`Referral ${dto.referralCode} applied for new driver ${driverId}`);
      } catch (refErr: any) {
        // Non-blocking: invalid/expired/self-referral/paused/out-of-window
        // just gets skipped. Driver account still created.
        this.logger.warn(`Referral application failed for driver ${driverId} (code: ${dto.referralCode}): ${refErr.message}`);
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
    const radiusMiles = this.parseSignupRadius(dto);

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

  /**
   * The signup form sends the radius as `preferredRadius` (a string, may be
   * empty — it's an optional select). Older API clients may send the numeric
   * `radiusMiles`. Parse leniently so a bad value can never block signup;
   * fall back to `radiusMiles`, then null.
   */
  private parseSignupRadius(dto: SignupDriverDto): number | null {
    const raw = dto.preferredRadius?.trim();
    if (raw) {
      const parsed = Number(raw.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(parsed) && parsed >= 1) {
        return Math.round(parsed);
      }
    }
    return dto.radiusMiles ?? null;
  }

  /**
   * Signup form sends a 5-digit home ZIP as `homeArea`. Normalize leniently:
   * only save well-formed 5-digit values (the form enforces this client-side;
   * onboarding-complete re-validates and overwrites later).
   */
  private normalizeSignupZip(homeArea?: string | null): string | null {
    if (typeof homeArea !== "string") return null;
    const zip = homeArea.trim();
    return /^\d{5}$/.test(zip) ? zip : null;
  }

  private buildDriverAlertsCreate(dto: SignupDriverDto) {
    // Signup form sends a single boolean named `emailAlerts` (meaning the
    // master alerts switch); API clients may send the granular fields.
    const emailAlerts = dto.emailAlertsEnabled ?? dto.emailAlerts ?? true;
    return {
      alerts: {
        create: {
          enabled: dto.alertsEnabled ?? emailAlerts,
          emailEnabled: emailAlerts,
          smsEnabled: dto.smsAlertsEnabled ?? false,
        },
      },
    };
  }

  private buildDriverDistrictsCreate(dto: SignupDriverDto) {
    // Signup form sends `districts`; API clients may send `districtIds`.
    const districtIds = (dto.districtIds ?? dto.districts ?? [])
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
  ): Promise<UserInfo | VerificationRequiredResult | PendingVerificationResult> {
    // ── Auto-approval rule ────────────────────────────────────────────────
    //
    // Business rule: PRIVATE customers do NOT need admin approval — they
    // join the platform as APPROVED immediately at signup, regardless of
    // location (regional availability is enforced outside the signup flow).
    // ALL business customers keep the existing PENDING → admin approval
    // flow, untouched.

    // ─── Private (individual) customer signup ─────────────────────────
    //
    // SERVER-SIDE STORAGE (no password in browser sessionStorage):
    //   Step 1 (no verificationToken):
    //     • Check if email exists
    //     • If exists + emailVerifiedAt=null → return PENDING_VERIFICATION
    //       (frontend shows dialog: "verify old signup or use another email")
    //     • If exists + verified → throw "Email already registered"
    //     • If not exists → create User with isActive=false,
    //       emailVerifiedAt=null (pending). Send OTP.
    //   Step 2 (with verificationToken):
    //     • Verify OTP
    //     • Find the User created in step 1
    //     • Activate (isActive=true, emailVerifiedAt=now) + create Customer
    //     • Issue tokens (auto-login)
    //
    // The frontend sends ONLY {email, verificationToken} in step 2 — no
    // password, no payload. The backend reads everything from the stored
    // User row. This is more secure and works across devices.
    //
    // BACKWARD COMPAT: if step 2 is called with the full payload (legacy
    // frontend or dealer signup), and no User exists yet, the backend
    // creates from the payload (old behavior).

    const normalizedEmail = dto.email.trim().toLowerCase();

    // ── Step 1: send OTP ────────────────────────────────────────────────
    if (!dto.verificationToken) {
      // Validate required fields for step 1
      if (!dto.password || dto.password.length < 6) {
        throw new BadRequestException("Password is required (min 6 characters)");
      }
      if (!dto.fullName) {
        throw new BadRequestException("Full name is required");
      }
      if (!dto.contactName) {
        throw new BadRequestException("Contact name is required");
      }

      // Check if a User with this email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, emailVerifiedAt: true, roles: true, createdAt: true },
      });

      if (existingUser) {
        if (existingUser.emailVerifiedAt == null) {
          // Pending signup — User was created but OTP never verified.
          // Return PENDING_VERIFICATION so the frontend can show the
          // "verify old signup or use another email" dialog.
          // Include createdAt so the dialog can display when the
          // registration was started.
          return {
            action: "PENDING_VERIFICATION",
            email: normalizedEmail,
            createdAt: existingUser.createdAt,
            message:
              "You started a registration with this email but didn't verify it. " +
              "Would you like to verify it now or use a different email?",
          };
        }
        // Email already registered and verified
        throw new BadRequestException(
          "This email is already registered. Please sign in instead."
        );
      }

      // Create the User row (inactive, unverified) — stores the password
      // hash and contact info server-side. No Customer row yet.
      const hashed = await this.passwordService.hash(dto.password);
      const userPhone = dto.contactPhone ?? dto.phone ?? null;

      await this.prisma.user.create({
        data: {
          username: this.generateUsernameFromEmail(normalizedEmail),
          email: normalizedEmail,
          password: hashed,
          roles: EnumUserRoles.PRIVATE_CUSTOMER,
          fullName: dto.fullName,
          phone: userPhone,
          isActive: false,
          emailVerifiedAt: null,
        },
      });

      // Send OTP
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

    // ── Step 2: verify OTP + create account ────────────────────────────
    await this.emailVerificationService.consumeTokenForEmail(
      normalizedEmail,
      dto.verificationToken,
      EnumEmailVerificationPurpose.SIGNUP
    );

    // Find the User created in step 1
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        username: true,
        roles: true,
        emailVerifiedAt: true,
        fullName: true,
        phone: true,
      },
    });

    if (existingUser && existingUser.emailVerifiedAt == null) {
      // ── New flow: User exists from step 1, activate it ──────────────
      const { userId, username, userRoles, customerId } = await this.prisma.$transaction(
        async (tx) => {
          // Activate the User
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              isActive: true,
              emailVerifiedAt: new Date(),
            },
          });

          // Create the Customer row
          //
          // Approval rule: ALL private customers are auto-APPROVED at signup
          // (no admin review needed). approvedByUserId stays NULL — approved
          // by the SYSTEM, not by an admin; the audit log below records why.
          const createdCustomer = await tx.customer.create({
            data: {
              customerType: EnumCustomerCustomerType.PRIVATE,
              contactName: dto.contactName || existingUser.fullName || "",
              contactEmail: normalizedEmail,
              contactPhone: existingUser.phone ?? dto.contactPhone ?? dto.phone ?? null,
              phone: dto.phone ?? existingUser.phone ?? null,
              approvalStatus: EnumCustomerApprovalStatus.APPROVED,
              approvedAt: new Date(),
              user: { connect: { id: existingUser.id } },
            },
            select: { id: true },
          });

          // Audit trail for auto-approvals — mirrors what the admin approval
          // engine writes (DEALER_APPROVE), but with actorType=SYSTEM and no
          // admin actor. This is how we can always answer "why is this
          // account APPROVED without an admin action?"
          await tx.adminAuditLog.create({
            data: {
              action: EnumAdminAuditLogAction.DEALER_APPROVE,
              actorUserId: null,
              actorType: EnumAdminAuditLogActorType.SYSTEM,
              customerId: createdCustomer.id,
              reason:
                "Auto-approved at signup: private customer (no admin review required)",
            },
          });

          return {
            userId: existingUser.id,
            username: existingUser.username,
            userRoles: existingUser.roles,
            customerId: createdCustomer.id,
          };
        },
      );

      // ── Auto-assign Flat Pricing at registration ──────────
      // Every new personal customer starts on Flat Pricing no matter what
      // the default config is; admins can reassign later. Non-blocking.
      await this.autoAssignPersonalFlatPricing(customerId);

      // ── Apply referral code if provided ────────────────────────────
      // Outside the transaction — non-blocking. Mirrors the driver signup
      // flow: invalid/expired/paused codes are silently skipped. The
      // customer account is already created at this point.
      if (dto.referralCode && customerId) {
        try {
          await this.referralService.applyCustomerReferral(customerId, dto.referralCode);
          this.logger.log(
            `Referral ${dto.referralCode} applied for new private customer ${customerId}`
          );
        } catch (refErr: any) {
          this.logger.warn(
            `Referral application failed for private customer ${customerId} (code: ${dto.referralCode}): ${refErr.message}`
          );
        }
      }

      return this.issueToken(
        userId,
        username,
        normalizedEmail,
        userRoles,
        request,
        response,
        existingUser.fullName ?? dto.fullName ?? "",
      );
    }

    // ── Backward compat: User doesn't exist (legacy/dealer flow) ───────
    // Create from the payload. This path is used when the old frontend
    // sends the full payload in step 2 (no User was created in step 1).
    if (!dto.password) {
      throw new BadRequestException(
        "No pending registration found. Please start a new registration."
      );
    }

    const hashed = await this.passwordService.hash(dto.password);
    const userPhone = dto.contactPhone ?? dto.phone ?? null;

    const { userId, username, userRoles, customerId } = await this.prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: this.generateUsernameFromEmail(normalizedEmail),
            email: normalizedEmail,
            password: hashed,
            roles: EnumUserRoles.PRIVATE_CUSTOMER,
            fullName: dto.fullName || "",
            phone: userPhone,
            isActive: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, username: true, roles: true },
        });

        // Same auto-approval rule as the primary path: ALL private
        // customers are APPROVED at signup (no admin review needed).
        const createdCustomer = await tx.customer.create({
          data: {
            customerType: EnumCustomerCustomerType.PRIVATE,
            contactName: dto.contactName || dto.fullName || "",
            contactEmail: normalizedEmail,
            contactPhone: userPhone,
            phone: dto.phone ?? null,
            approvalStatus: EnumCustomerApprovalStatus.APPROVED,
            approvedAt: new Date(),
            user: { connect: { id: createdUser.id } },
          },
          select: { id: true },
        });

        await tx.adminAuditLog.create({
          data: {
            action: EnumAdminAuditLogAction.DEALER_APPROVE,
            actorUserId: null,
            actorType: EnumAdminAuditLogActorType.SYSTEM,
            customerId: createdCustomer.id,
            reason:
              "Auto-approved at signup: private customer (no admin review required)",
          },
        });

        return {
          userId: createdUser.id,
          username: createdUser.username,
          userRoles: createdUser.roles,
          customerId: createdCustomer.id,
        };
      },
    );

    // ── Auto-assign Flat Pricing at registration ──────────
    // Every new personal customer starts on Flat Pricing no matter what
    // the default config is; admins can reassign later. Non-blocking.
    await this.autoAssignPersonalFlatPricing(customerId);

    // ── Apply referral code if provided (legacy path) ──
    if (dto.referralCode && customerId) {
      try {
        await this.referralService.applyCustomerReferral(customerId, dto.referralCode);
        this.logger.log(
          `Referral ${dto.referralCode} applied for new private customer (legacy path) ${customerId}`
        );
      } catch (refErr: any) {
        this.logger.warn(
          `Referral application failed for private customer ${customerId} (code: ${dto.referralCode}): ${refErr.message}`
        );
      }
    }

    return this.issueToken(
      userId,
      username,
      normalizedEmail,
      userRoles,
      request,
      response,
      dto.fullName || "",
    );
  }

  /**
   * Resend OTP for a pending private customer signup.
   *
   * Called when a user tries to sign up with an email that has a pending
   * (unverified) registration, and chooses "Verify the old signup" in the
   * dialog. Generates a new OTP and sends it to the email.
   *
   * The User row already exists (created in step 1 of signupPrivateCustomer)
   * — this just sends a fresh OTP.
   */
  async resendPrivateCustomerOtp(email: string): Promise<VerificationRequiredResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailVerifiedAt: true, fullName: true, roles: true },
    });

    if (!existingUser) {
      throw new BadRequestException(
        "No pending registration found for this email. Please start a new registration."
      );
    }

    if (existingUser.emailVerifiedAt != null) {
      throw new BadRequestException(
        "This email is already verified. Please sign in instead."
      );
    }

    if (existingUser.roles !== EnumUserRoles.PRIVATE_CUSTOMER) {
      throw new BadRequestException(
        "This email is associated with a different account type. Please use the correct signup page."
      );
    }

    await this.emailVerificationService.requestVerification(
      normalizedEmail,
      existingUser.fullName,
      "PRIVATE_CUSTOMER"
    );

    return {
      action: "VERIFICATION_REQUIRED",
      email: normalizedEmail,
      message: "A new verification code has been sent to your email.",
    };
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

    // dto.password is optional in the DTO (made optional so the private
    // customer verify step can send only {email, otp}). For business
    // signup, the password is always required — validate here.
    if (!dto.password) {
      throw new BadRequestException("Password is required");
    }

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

    const { userId, username, userRoles, customerId } = await this.prisma.$transaction(
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

        const createdCustomer = await tx.customer.create({
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
            // Business customers are advertised (and quoted on the public
            // landing page) at the FLAT rate ($101 prepaid + per-mile beyond
            // the included miles). The default active pricing config may be
            // CATEGORY_ABC, so pin the flat model explicitly — every future
            // quote for this customer (landing, dealer dashboard, delivery
            // creation) prices identically. Admins can still re-assign a
            // per-customer config or override at any time (an explicit
            // admin assignment always takes precedence in the engine).
            pricingModeOverride: EnumCustomerPricingModeOverride.PER_MILE,
            user: { connect: { id: createdUser.id } },
          },
          select: { id: true },
        });

        return {
          userId: createdUser.id,
          username: createdUser.username,
          userRoles: createdUser.roles,
          customerId: createdCustomer.id,
        };
      },
    );

    // ── Apply referral code if provided ─────────────────────────────
    // Outside the transaction — non-blocking. Mirrors the driver signup
    // flow: invalid/expired/paused codes are silently skipped. The
    // customer account is already created at this point.
    if (dto.referralCode && customerId) {
      try {
        await this.referralService.applyCustomerReferral(customerId, dto.referralCode);
        this.logger.log(
          `Referral ${dto.referralCode} applied for new business customer ${customerId}`
        );
      } catch (refErr: any) {
        this.logger.warn(
          `Referral application failed for business customer ${customerId} (code: ${dto.referralCode}): ${refErr.message}`
        );
      }
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
      maxAge: REFRESH_COOKIE_MAX_MS,
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

  /**
   * California-only driver onboarding rule — SINGLE SOURCE OF TRUTH.
   *
   * 101 Drivers operates exclusively in California. Every California ZIP
   * code falls in the contiguous range 90001–96199 (the 9xx block below
   * 97000 — Oregon starts at 97000, Washington at 98000, Alaska at 99500),
   * and no OTHER state's ZIP falls inside that range, so a range check
   * can never wrongly reject a Californian and needs no ZIP database.
   * (Caveat, by design: a handful of UNASSIGNED numbers inside the range
   * are accepted too — they belong to no state, so they can never let an
   * out-of-state driver through.)
   *
   * Consumed by:
   *   - assertCaliforniaHomeArea()  → signupDriver hard guard (throws)
   *   - validateHomeAreaZip()       → public GET /auth/public/validate-zip/:zip
   *     used by the signup form for the live green/red field verdict.
   */
  private evaluateCaliforniaHomeArea(homeArea?: string | null): {
    valid: boolean;
    zip: string;
    reason: "INVALID_FORMAT" | "OUT_OF_STATE" | null;
  } {
    const zip = (homeArea ?? "").trim();
    if (!/^\d{5}$/.test(zip)) {
      return { valid: false, zip, reason: "INVALID_FORMAT" };
    }
    const numeric = parseInt(zip, 10);
    if (numeric < 90001 || numeric > 96199) {
      return { valid: false, zip, reason: "OUT_OF_STATE" };
    }
    return { valid: true, zip, reason: null };
  }

  /**
   * Hard guard used by signupDriver. Called at the very top so BOTH the
   * OTP request (call 1, no verificationToken) and the account creation
   * (call 2, with token) reject out-of-state applicants — no OTP email is
   * sent and no User or Driver row is ever created for a non-California
   * ZIP. The frontend mirrors this rule for instant feedback and queries
   * validateHomeAreaZip for the live field verdict; this remains the
   * authoritative server-side backstop.
   */
  private assertCaliforniaHomeArea(homeArea?: string | null): void {
    const verdict = this.evaluateCaliforniaHomeArea(homeArea);
    if (verdict.reason === "INVALID_FORMAT") {
      throw new BadRequestException(
        "A valid 5-digit ZIP code is required to register as a driver."
      );
    }
    if (!verdict.valid) {
      throw new BadRequestException(
        "We currently only operate in California. Your ZIP code is outside California, so we can't accept your driver registration."
      );
    }
  }

  /**
   * Public field-level ZIP check for the driver signup form
   * (GET /auth/public/validate-zip/:zip). Same rule as the signup guard
   * (evaluateCaliforniaHomeArea) but returns a structured verdict instead
   * of throwing, so the form can show green "in California" / red "not in
   * California" feedback while typing — mirroring the referral-code
   * resolve endpoint pattern. Always 200, never auth-required.
   */
  validateHomeAreaZip(zip?: string): {
    valid: boolean;
    zip: string;
    state: "CA" | null;
    reason: "INVALID_FORMAT" | "OUT_OF_STATE" | null;
    message: string;
  } {
    const verdict = this.evaluateCaliforniaHomeArea(zip);
    if (verdict.valid) {
      return {
        valid: true,
        zip: verdict.zip,
        state: "CA",
        reason: null,
        message: "In California — we serve this area.",
      };
    }
    if (verdict.reason === "INVALID_FORMAT") {
      return {
        valid: false,
        zip: verdict.zip,
        state: null,
        reason: "INVALID_FORMAT",
        message: "Enter a valid 5-digit ZIP code.",
      };
    }
    return {
      valid: false,
      zip: verdict.zip,
      state: null,
      reason: "OUT_OF_STATE",
      message:
        "Not in California — we only accept drivers based in California (ZIP 90001–96199).",
    };
  }

  private generateUsernameFromEmail(email: string): string {
    const base = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");
    return `${base}_${Date.now()}`;
  }

  /**
   * Auto-assign the active Flat Pricing (PER_MILE) config to a newly
   * registered PERSONAL customer — no matter what the system default
   * config is.
   *
   * Preference order:
   *   1. the system default config — but only when it is an ACTIVE flat
   *      config;
   *   2. otherwise the most recently created active flat config.
   * When no active flat config exists the customer is left unassigned and
   * pricing falls back to the system default resolution.
   *
   * Non-blocking by contract: everything is wrapped in try/catch and only
   * logged — a missing config or a race must never break account creation.
   * Admins can reassign any config later via the admin pricing UI.
   */
  private async autoAssignPersonalFlatPricing(customerId: string): Promise<void> {
    try {
      // 1) System default — only if it is an ACTIVE FLAT config.
      const defaultFlat = await this.prisma.pricingConfig.findFirst({
        where: { active: true, isDefault: true, pricingMode: "PER_MILE" },
        select: { id: true },
      });

      let flatConfigId: string | null = defaultFlat?.id ?? null;

      // 2) Otherwise the most recently created active flat config.
      if (!flatConfigId) {
        const latestFlat = await this.prisma.pricingConfig.findFirst({
          where: { active: true, pricingMode: "PER_MILE" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        flatConfigId = latestFlat?.id ?? null;
      }

      if (!flatConfigId) {
        this.logger.warn(
          `No active Flat Pricing config found — new personal customer ${customerId} stays on the system default config`
        );
        return;
      }

      await this.prisma.customer.update({
        where: { id: customerId },
        data: { pricingConfig: { connect: { id: flatConfigId } } },
      });

      // Audit trail — mirrors the auto-approve pattern (actorType=SYSTEM,
      // no admin actor) so "why does this personal customer have this
      // config?" is always answerable.
      await this.prisma.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.PRICING_UPDATE,
          actorUserId: null,
          actorType: EnumAdminAuditLogActorType.SYSTEM,
          customerId,
          reason: "Auto-assigned Flat Pricing config at registration",
        },
      });

      this.logger.log(
        `Auto-assigned flat pricing config ${flatConfigId} to new personal customer ${customerId}`
      );
    } catch (err: any) {
      this.logger.warn(
        `Flat pricing auto-assign failed for personal customer ${customerId}: ${err?.message}`
      );
    }
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