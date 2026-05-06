import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
import {
  EnumCustomerCustomerType,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly customerService: CustomerService,
    private readonly driverService: DriverService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly notificationEventEngine: NotificationEventEngine,
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
      };
    }

    if (roles.includes(String(EnumUserRoles.DRIVER))) {
      const driver = await this.driverService.driver({
        where: { userId },
        select: {
          id: true,
          status: true,
        },
      } as any);

      return {
        profileId: driver?.id ?? null,
        customerApprovalStatus: null,
        driverStatus: driver?.status ?? null,
      };
    }

    return {
      profileId: null,
      customerApprovalStatus: null,
      driverStatus: null,
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

    const user = await this.userService.createUser({
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
      select: { id: true, username: true, email: true, roles: true },
    } as any);

    await this.driverService.createDriver({
      data: {
        status: EnumDriverStatus.PENDING,
        phone: dto.phone ?? null,
        profilePhotoUrl: dto.profilePhotoUrl ?? null,
        user: { connect: { id: user.id } },

        ...(this.buildDriverPreferenceCreate(dto)),
        ...(this.buildDriverAlertsCreate(dto)),
        ...(this.buildDriverDistrictsCreate(dto)),
      },
      select: { id: true },
    } as any);

    // Send confirmation email to driver after successful sign-up
    try {
      await this.notificationEventEngine.queueAndSend({
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_SIGNUP,
        templateCode: "driver-signup-confirmation",
        toEmail: normalizedEmail,
        subject: "Your application to join 101 Drivers has been received",
        body: [
          `Hi ${dto.fullName},`,
          "",
          "Thank you!",
          "Your application to join 101 Drivers has been received.",
          "Your account is pending approval. We'll review your information and contact you when we're ready to bring on new drivers.",
        ].join("\n"),
        payload: {
          driverEmail: normalizedEmail,
          driverName: dto.fullName,
          signupAt: new Date().toISOString(),
        },
      });
    } catch (notificationError) {
      // Log but don't block signup if notification fails
      console.error("Failed to send driver signup confirmation email:", notificationError);
    }

    return this.issueToken(
      user.id,
      user.username,
      (user as any).email ?? null,
      user.roles,
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
    _dto: SignupCustomerDto,
    _request: Request,
    _response: Response
  ): Promise<never> {
    throw new BadRequestException(
      "Private customer signup is deprecated. Use /deliveryRequests/individual/create-from-quote"
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

    await this.ensureEmailDoesNotExist(normalizedEmail);

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

    const user = await this.userService.createUser({
      data: {
        username: this.generateUsernameFromEmail(normalizedEmail),
        email: normalizedEmail,
        password: hashed,
        roles: EnumUserRoles.BUSINESS_CUSTOMER,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, username: true, email: true, roles: true },
    } as any);

    await this.customerService.createCustomer({
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
        user: { connect: { id: user.id } },
      },
      select: { id: true },
    });

    return this.issueToken(
      user.id,
      user.username,
      (user as any).email ?? null,
      user.roles,
      request,
      response,
      dto.fullName
    );
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
      isActive: true,
    } as UserInfo;
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