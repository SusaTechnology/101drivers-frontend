import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

export type VerificationAudience =
  | "DRIVER"
  | "BUSINESS_CUSTOMER"
  | "PRIVATE_CUSTOMER"
  | "PASSWORD_RESET";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly appDomain: string;
  private readonly smtpConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = Number(this.configService.get<string>("SMTP_PORT") ?? 587);
    const secure =
      String(this.configService.get<string>("SMTP_SECURE") ?? "false") === "true";
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");

    this.from =
      this.configService.get<string>("SMTP_FROM") ??
      "TechBee ERP <innovationstechbee@gmail.com>";

    this.appDomain =
      this.normalizeBaseUrl(
        this.configService.get<string>("101_DOMAIN") ??
          "https://101drivers.techbee.et"
      );

    if (!host || !user || !pass) {
      this.smtpConfigured = false;
      this.transporter = null;
      this.logger.warn(
        "SMTP configuration is incomplete (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). " +
        "Email sending will be disabled. Notifications will be logged but not delivered."
      );
      return;
    }

    this.smtpConfigured = true;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      // Guard against hung SMTP connections. Without these, a slow or
      // misbehaving SMTP server could stall sendMail() for minutes and pile
      // up stuck sockets (delivery now runs in the background, so these
      // timeouts bound how long each background send can occupy resources).
      connectionTimeout: 15_000, // TCP connect + TLS handshake
      greetingTimeout: 15_000, // wait for the server's 220 banner
      socketTimeout: 30_000, // max idle time between SMTP replies
    });

    this.logger.log("SMTP transporter configured successfully");
  }

  get isConfigured(): boolean {
    return this.smtpConfigured;
  }

  async sendMail(params: {
    to: string;
    subject: string;
    text?: string | null;
    html?: string | null;
  }): Promise<void> {
    if (!this.smtpConfigured || !this.transporter) {
      this.logger.warn(
        `Email not sent (SMTP not configured). to=${params.to}, subject="${params.subject}"`
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text ?? undefined,
        html: params.html ?? undefined,
      });

      this.logger.log(`Email sent to ${params.to}: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${params.to}: ${error?.message ?? error}`
      );
      throw new Error(`Failed to send email: ${error?.message ?? "unknown error"}`);
    }
  }

  async sendEmailVerification(params: {
    toEmail: string;
    token: string;
    fullName?: string | null;
    audience?: VerificationAudience;
  }): Promise<void> {
    const normalizedEmail = params.toEmail.trim().toLowerCase();
    const displayName = params.fullName?.trim() || "there";
    const audience = params.audience ?? "DRIVER";

    const destinationUrl = this.getVerificationDestinationUrl(
      audience,
      params.token,
      audience === "PASSWORD_RESET" ? normalizedEmail : undefined
    );

    const subject =
      audience === "PASSWORD_RESET"
        ? "Your 101 Drivers password reset code"
        : "Your 101 Drivers verification code";

    const intro =
      audience === "PASSWORD_RESET"
        ? "Use the code below to reset your 101 Drivers password."
        : audience === "PRIVATE_CUSTOMER"
        ? "Use the verification code below to continue your 101 Drivers signup."
        : "Use the verification code below to continue your 101 Drivers signup.";

    const actionLabel =
      audience === "PASSWORD_RESET"
        ? "Reset Password"
        : audience === "PRIVATE_CUSTOMER"
        ? "Continue Signup"
        : "Continue Signup";

    const helperText =
      audience === "PASSWORD_RESET"
        ? "Copy and paste this code into the reset password form."
        : audience === "PRIVATE_CUSTOMER"
        ? "Copy and paste this code into the signup form."
        : "Copy and paste this code into the signup form.";

    const text = [
      `Hi ${displayName},`,
      "",
      intro,
      "",
      `Verification code: ${params.token}`,
      "",
      helperText,
      "",
      `Continue here: ${destinationUrl}`,
      "",
      "This code expires in 15 minutes.",
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n");

    const heading =
      audience === "PASSWORD_RESET"
        ? "Reset your password"
        : "Your verification code";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>${this.escapeHtml(heading)}</h2>
        <p>Hi ${this.escapeHtml(displayName)},</p>
        <p>${this.escapeHtml(intro)}</p>

        <div
          style="
            margin: 24px 0 12px 0;
            padding: 16px 20px;
            display: inline-block;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f8f8f8;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 8px;
            font-family: Arial, sans-serif;
          "
        >
          ${this.escapeHtml(params.token)}
        </div>

        <p style="margin-top: 8px; color: #444;">
          ${this.escapeHtml(helperText)}
        </p>

        <p>
          <a
            href="${this.escapeHtml(destinationUrl)}"
            style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;"
          >
            ${this.escapeHtml(actionLabel)}
          </a>
        </p>

        <p>Or open this page directly:</p>
        <p>${this.escapeHtml(destinationUrl)}</p>

        <p>This code expires in 15 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `;

    await this.sendMail({
      to: params.toEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Admin invite email — sent to a newly invited administrator.
   * Contains a single-use setup link (48h expiry) that lets the new admin
   * set their own password. No default password ever exists.
   */
  async sendAdminInviteEmail(params: {
    toEmail: string;
    token: string;
    fullName?: string | null;
    invitedByEmail?: string | null;
  }): Promise<void> {
    const normalizedEmail = params.toEmail.trim().toLowerCase();
    const displayName = params.fullName?.trim() || "there";
    const setupUrl = `${this.appDomain}/auth/accept-invite?token=${encodeURIComponent(
      params.token
    )}`;

    const subject = "Set up your 101 Drivers admin account";

    const text = [
      `Hi ${displayName},`,
      "",
      `You have been invited to join 101 Drivers as an administrator${
        params.invitedByEmail ? ` by ${params.invitedByEmail}` : ""
      }.`,
      "",
      "Use the secure link below to set your own password and activate your account:",
      "",
      setupUrl,
      "",
      "This link expires in 48 hours and can only be used once.",
      "",
      "If you were not expecting this invitation, you can safely ignore this email.",
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>You're invited to join 101 Drivers as an administrator</h2>
        <p>Hi ${this.escapeHtml(displayName)},</p>
        <p>${
          params.invitedByEmail
            ? this.escapeHtml(`${params.invitedByEmail} invited you`)
            : "You have been invited"
        } to administer the 101 Drivers delivery platform.</p>
        <p>Click the button below to set your own password and activate your account. For your security, no password was created for you in advance.</p>

        <p>
          <a
            href="${this.escapeHtml(setupUrl)}"
            style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;"
          >
            Set up my account
          </a>
        </p>

        <p>Or open this page directly:</p>
        <p>${this.escapeHtml(setupUrl)}</p>

        <p style="color:#444;">This link expires in 48 hours and can only be used once.</p>
        <p>If you were not expecting this invitation, you can safely ignore this email.</p>
      </div>
    `;

    await this.sendMail({
      to: normalizedEmail,
      subject,
      text,
      html,
    });
  }

  private getVerificationDestinationUrl(
    audience: VerificationAudience,
    token: string,
    email?: string
  ): string {
    switch (audience) {
      case "BUSINESS_CUSTOMER":
        return `${this.appDomain}/auth/dealer-signup?otp=${encodeURIComponent(token)}`;
      case "PRIVATE_CUSTOMER":
        return `${this.appDomain}/auth/individual-verify-email?otp=${encodeURIComponent(token)}`;
      case "PASSWORD_RESET":
        const params = new URLSearchParams();
        if (email) params.set("email", email);
        return `${this.appDomain}/auth/reset-password?${params.toString()}`;
      case "DRIVER":
      default:
        return `${this.appDomain}/driver-verify-email?otp=${encodeURIComponent(token)}`;
    }
  }

  private normalizeBaseUrl(value: string): string {
    return value.trim().replace(/\/+$/, "");
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}