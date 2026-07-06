import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EnumEmailVerificationPurpose } from "@prisma/client";
import { createHash, randomInt } from "crypto";
import {
  MailService,
  VerificationAudience,
} from "../../common/mail/mail.service";

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  async requestVerification(
    email: string,
    fullName?: string | null,
    audience: VerificationAudience = "DRIVER"
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const rawToken = this.generateOtp();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const purpose =
      audience === "PASSWORD_RESET"
        ? EnumEmailVerificationPurpose.PASSWORD_RESET
        : EnumEmailVerificationPurpose.SIGNUP;

    await this.prisma.emailVerificationToken.updateMany({
      where: {
        email: normalizedEmail,
        purpose,
        verifiedAt: null,
      },
      data: {
        expiresAt: new Date(),
      },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        email: normalizedEmail,
        tokenHash,
        purpose,
        expiresAt,
      },
    });

    await this.mailService.sendEmailVerification({
      toEmail: normalizedEmail,
      token: rawToken,
      fullName: fullName ?? null,
      audience,
    });

    return {
      message:
        audience === "PASSWORD_RESET"
          ? "Password reset OTP sent"
          : audience === "PRIVATE_CUSTOMER"
          ? "Private customer verification OTP sent"
          : "Verification OTP sent",
    };
  }

  async consumeTokenForEmail(
    email: string,
    token: string,
    purpose: EnumEmailVerificationPurpose = EnumEmailVerificationPurpose.SIGNUP
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      throw new BadRequestException("Verification code is required");
    }

    if (!/^\d{6}$/.test(normalizedToken)) {
      throw new BadRequestException(
        "Verification code must be a valid 6-digit OTP"
      );
    }

    const tokenHash = this.hashToken(normalizedToken);

    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        email: normalizedEmail,
        tokenHash,
        purpose,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new BadRequestException("Invalid verification code");
    }

    if (record.verifiedAt) {
      throw new BadRequestException("Verification code already used");
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException("Verification code expired");
    }

    await this.prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: {
        verifiedAt: new Date(),
      },
    });
  }
}