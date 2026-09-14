import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumEmailVerificationPurpose,
  EnumUserRoles,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "../auth/password.service";
import { MailService } from "../common/mail/mail.service";

/**
 * Admin invite flow.
 *
 * Replaces the legacy "Create Admin" password form (where the creating
 * admin typed a password and shared it out-of-band). Now:
 *
 *   1. An existing admin invites a colleague by name + email only.
 *   2. We create the ADMIN user with an unguessable random placeholder
 *      credential (bcrypt-hashed, stored in BOTH `password` and
 *      `passwordHash` columns — nobody knows the plaintext).
 *   3. We email a single-use setup link (sha256-hashed token at rest,
 *      48h expiry, purpose ADMIN_INVITE).
 *   4. The invitee opens the link and sets their own password. The token
 *      is consumed and the account's email is marked verified.
 *
 * No default password ever exists and the creating admin never learns
 * the invitee's credential.
 */

const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

@Injectable()
export class AdminInviteService {
  private readonly logger = new Logger(AdminInviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly mailService: MailService
  ) {}

  // ==================== INVITE (create or re-invite) ====================

  async inviteAdmin(input: {
    email: string;
    fullName: string;
    phone?: string | null;
    actorUserId?: string | null;
  }): Promise<any> {
    const email = this.normalizeEmail(input.email);
    const fullName = (input.fullName ?? "").trim();

    if (!fullName) {
      throw new BadRequestException("Full name is required");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing && !(existing.roles === EnumUserRoles.ADMIN && !existing.emailVerifiedAt)) {
      // Email already used by an active/verified account or another role —
      // never reveal more than necessary.
      throw new BadRequestException(
        "A user with this email already exists. If this is the right person, they can sign in or reset their password instead."
      );
    }

    let user = existing;

    if (!user) {
      // New administrator. Placeholder credential is a random secret that is
      // immediately bcrypt-hashed — the plaintext is discarded, so the only
      // way into the account is the invite link (or a later password reset).
      const placeholderSecret = randomBytes(32).toString("base64url");
      const placeholderHash = await this.passwordService.hash(placeholderSecret);
      const username = await this.generateUsername(email);

      user = await this.prisma.user.create({
        data: {
          email,
          username,
          // Consistent credential storage: bcrypt hash in BOTH columns
          // (validateUser compares against `passwordHash ?? password`).
          password: placeholderHash,
          passwordHash: placeholderHash,
          fullName,
          phone: input.phone?.trim() || null,
          roles: EnumUserRoles.ADMIN,
          isActive: true,
        },
      });

      this.logger.log(`Admin user created via invite: ${email} (${user.id})`);
    } else {
      // Pending (unverified) admin re-invited: refresh profile details.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          fullName,
          ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
          isActive: true,
        },
      });
    }

    const rawToken = await this.issueInviteToken(email);

    try {
      await this.mailService.sendAdminInviteEmail({
        toEmail: email,
        token: rawToken,
        fullName,
        invitedByEmail: await this.actorEmail(input.actorUserId),
      });
    } catch (error) {
      // The account and token exist, so a resend can recover. Surface the error.
      this.logger.error(
        `Failed to send admin invite email to ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new BadRequestException(
        "Invite created but the email could not be sent. Use 'Resend invite' to try again."
      );
    }

    await this.writeAudit({
      actorUserId: input.actorUserId ?? null,
      targetUserId: user.id,
      action: existing ? "Admin invite resent" : "Admin user invited by email",
    });

    return this.getAdminUserDetail(user.id);
  }

  async resendInvite(input: {
    userId: string;
    actorUserId?: string | null;
  }): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.roles !== EnumUserRoles.ADMIN) {
      throw new BadRequestException("Invite links can only be sent to admin accounts");
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException(
        "This admin has already set up their account — no pending invite to resend"
      );
    }

    const rawToken = await this.issueInviteToken(user.email);

    try {
      await this.mailService.sendAdminInviteEmail({
        toEmail: user.email,
        token: rawToken,
        fullName: user.fullName,
        invitedByEmail: await this.actorEmail(input.actorUserId),
      });
    } catch (error) {
      this.logger.error(
        `Failed to resend admin invite email to ${user.email}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new BadRequestException(
        "Email could not be sent right now. Please try again."
      );
    }

    await this.writeAudit({
      actorUserId: input.actorUserId ?? null,
      targetUserId: user.id,
      action: "Admin invite resent",
    });

    return this.getAdminUserDetail(user.id);
  }

  // ==================== VALIDATE (page load) ====================

  /**
   * Check an invite token WITHOUT consuming it. Returns the invitee's
   * identity so the accept-invite page can greet them. Throws on any problem.
   */
  async validateInviteToken(token: string): Promise<{ email: string; fullName: string | null }> {
    const record = await this.findValidInviteToken(token);

    const user = await this.prisma.user.findUnique({
      where: { email: record.email },
    });

    if (!user || user.roles !== EnumUserRoles.ADMIN) {
      throw new BadRequestException("This invite link is no longer valid");
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException(
        "This invite has already been accepted. Try signing in instead."
      );
    }

    return { email: user.email, fullName: user.fullName };
  }

  // ==================== ACCEPT (set password) ====================

  async acceptInvite(input: { token: string; password: string }): Promise<{ email: string }> {
    const password = (input.password ?? "").trim();

    if (!input.token?.trim()) {
      throw new BadRequestException("Invite token is missing");
    }

    this.assertPasswordPolicy(password);

    const record = await this.findValidInviteToken(input.token);

    const user = await this.prisma.user.findUnique({
      where: { email: record.email },
    });

    if (!user || user.roles !== EnumUserRoles.ADMIN) {
      throw new BadRequestException("This invite link is no longer valid");
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException(
        "This invite has already been accepted. Try signing in instead."
      );
    }

    const passwordHash = await this.passwordService.hash(password);

    await this.prisma.$transaction([
      // Consistent credential storage: bcrypt hash in BOTH columns.
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { verifiedAt: new Date() },
      }),
    ]);

    // Invalidate any other pending invite links for this email.
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        email: record.email,
        purpose: EnumEmailVerificationPurpose.ADMIN_INVITE,
        verifiedAt: null,
      },
      data: { expiresAt: new Date() },
    });

    this.logger.log(`Admin invite accepted for ${user.email}`);

    await this.writeAudit({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "Admin invite accepted; password set by invitee",
    });

    return { email: user.email };
  }

  // ==================== INTERNALS ====================

  private normalizeEmail(email: string): string {
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      throw new BadRequestException("A valid email address is required");
    }
    return normalized;
  }

  /**
   * Invalidate any previous pending invite tokens for the email, then store
   * the sha256 hash of a fresh 48h single-use token. Returns the raw token
   * (only time it exists — it is never persisted in plaintext).
   */
  private async issueInviteToken(email: string): Promise<string> {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.emailVerificationToken.updateMany({
      where: {
        email,
        purpose: EnumEmailVerificationPurpose.ADMIN_INVITE,
        verifiedAt: null,
      },
      data: { expiresAt: new Date() },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        email,
        tokenHash,
        purpose: EnumEmailVerificationPurpose.ADMIN_INVITE,
        expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      },
    });

    return rawToken;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async findValidInviteToken(token: string) {
    const normalized = (token ?? "").trim();
    if (!normalized || normalized.length > 512) {
      throw new BadRequestException("This invite link is not valid");
    }

    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash: this.hashToken(normalized),
        purpose: EnumEmailVerificationPurpose.ADMIN_INVITE,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new BadRequestException("This invite link is not valid");
    }

    if (record.verifiedAt) {
      throw new BadRequestException(
        "This invite link was already used. Try signing in instead."
      );
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException(
        "This invite link has expired. Ask an administrator to resend it."
      );
    }

    return record;
  }

  /** Username derived from the email prefix; suffix appended on collision. */
  private async generateUsername(email: string): Promise<string> {
    const prefix = email.split("@")[0].replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "admin";
    let candidate = prefix;

    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!taken) {
        return candidate;
      }
      candidate = `${prefix}-${randomBytes(3).toString("hex")}`;
    }

    return `${prefix}-${Date.now().toString(36)}`;
  }

  private async actorEmail(actorUserId?: string | null): Promise<string | null> {
    if (!actorUserId) return null;
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { email: true },
    });
    return actor?.email ?? null;
  }

  private async writeAudit(input: {
    actorUserId: string | null;
    targetUserId: string;
    action: string;
  }): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.OTHER,
          actorUserId: input.actorUserId,
          actorType: input.actorUserId
            ? EnumAdminAuditLogActorType.USER
            : EnumAdminAuditLogActorType.SYSTEM,
          userId: input.targetUserId,
          reason: input.action,
        },
      });
    } catch (error) {
      // Audit logging must never break the invite flow.
      this.logger.warn(
        `Failed to write admin audit log for invite action: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Same policy as the customer/driver reset-password form. */
  private assertPasswordPolicy(password: string): void {
    const checks: [boolean, string][] = [
      [password.length >= 8, "Password must be at least 8 characters"],
      [/[A-Z]/.test(password), "Password must contain at least one uppercase letter"],
      [/[a-z]/.test(password), "Password must contain at least one lowercase letter"],
      [/[0-9]/.test(password), "Password must contain at least one number"],
      [
        /[^A-Za-z0-9]/.test(password),
        "Password must contain at least one special character",
      ],
    ];

    for (const [ok, message] of checks) {
      if (!ok) throw new BadRequestException(message);
    }
  }

  /** Same admin-detail payload shape used by the other admin user endpoints. */
  private async getAdminUserDetail(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        disabledAt: true,
        disabledReason: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
}
