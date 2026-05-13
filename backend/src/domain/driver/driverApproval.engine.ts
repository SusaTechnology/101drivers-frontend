import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDriverStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";
import { randomBytes } from "crypto";

@Injectable()
export class DriverApprovalEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

  /**
   * INVITE: Admin invites a waitlisted driver to complete the full application.
   * WAITLISTED → INVITED
   * Generates onboarding token and sends invitation email.
   */
  async inviteDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status !== EnumDriverStatus.WAITLISTED) {
      throw new BadRequestException("Only waitlisted drivers can be invited");
    }

    const beforeJson = driver;

    // Generate a unique onboarding token for the driver
    const onboardingToken = randomBytes(32).toString("hex");

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.INVITED,
        onboardingToken,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    const displayName = driver.user?.fullName || "Driver";

    if (toEmail) {
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        driverId: input.driverId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_APPROVED,
        templateCode: "driver-invited",
        subject: "You\u2019re invited to complete your driver application \u2014 101 Drivers",
        body: [
          `Hi ${displayName},`,
          "",
          "Good news! You\u2019ve been selected to move forward with your driver application.",
          "Please complete your application by visiting the link below:",
          "",
          `https://${(process.env.APP_DOMAIN || "101drivers.techbee.et").replace(/^https?:\/\//, "")}/driver-onboarding-complete?token=${onboardingToken}`,
          "",
          "You will need to provide the following:",
          "",
          "\u2022  Driver\u2019s license (front and back photos)",
          "\u2022  Social Security Number",
          "\u2022  Current residential address",
          "\u2022  Selfie photo for identity verification",
          "",
          "Once we receive your complete application, we\u2019ll review it and get back to you.",
          input.note ? `\nNote from our team: ${input.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          driverId: input.driverId,
          invitedAt: afterDriver ? new Date().toISOString() : null,
          note: input.note ?? null,
        },
      });
    }
  }

  /**
   * APPROVE: Admin approves a driver who submitted their full application.
   * PENDING_APPROVAL → APPROVED
   */
  async approveDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        approvedByUserId: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.APPROVED) {
      throw new BadRequestException("Driver is already approved");
    }

    if (driver.status !== EnumDriverStatus.PENDING_APPROVAL) {
      throw new BadRequestException("Only drivers with pending approval can be approved");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: input.actorUserId
          ? { connect: { id: input.actorUserId } }
          : undefined,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_APPROVE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    const displayName = driver.user?.fullName || "Driver";

    if (toEmail) {
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        driverId: input.driverId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_APPROVED,
        templateCode: "driver-approved",
        subject: "Your driver application has been approved \u2014 101 Drivers",
        body: [
          `Hi ${displayName},`,
          "",
          "Great news! Your driver application has been approved.",
          "You now have access to the 101 Drivers platform.",
          "Log in to your account to start viewing available deliveries.",
          input.note ? `\nNote from our team: ${input.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          driverId: input.driverId,
          approvedAt: afterDriver?.approvedAt ?? null,
          note: input.note ?? null,
        },
      });
    }
  }

  /**
   * SUSPEND: Admin suspends an approved driver.
   * APPROVED → SUSPENDED
   */
  async suspendDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    reason: string;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.SUSPENDED) {
      throw new BadRequestException("Driver is already suspended");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.SUSPENDED,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_SUSPEND,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.reason,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * UNSUSPEND: Admin unsuspends a suspended driver back to approved.
   * SUSPENDED → APPROVED
   */
  async unsuspendDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const beforeJson = driver;

    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.APPROVED,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_UNSUSPEND,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * REJECT: Admin rejects a driver application.
   * INVITED or PENDING_APPROVAL → REJECTED (sets status instead of deleting)
   */
  async rejectDriver(input: {
    driverId: string;
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        approvedByUserId: true,
        userId: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status === EnumDriverStatus.APPROVED) {
      throw new BadRequestException("Approved driver cannot be rejected");
    }

    if (driver.status === EnumDriverStatus.SUSPENDED) {
      throw new BadRequestException("Suspended driver cannot be rejected");
    }

    if (driver.status === EnumDriverStatus.REJECTED) {
      throw new BadRequestException("Driver is already rejected");
    }

    if (
      driver.status !== EnumDriverStatus.WAITLISTED &&
      driver.status !== EnumDriverStatus.INVITED &&
      driver.status !== EnumDriverStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException("Driver cannot be rejected in current status");
    }

    const beforeJson = driver;

    // Set status to REJECTED instead of deleting
    await this.prisma.driver.update({
      where: { id: input.driverId },
      data: {
        status: EnumDriverStatus.REJECTED,
      },
    });

    const afterDriver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.reason ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDriver ?? Prisma.JsonNull,
      },
    });

    const toEmail = driver.user?.email?.trim().toLowerCase() || null;
    const displayName = driver.user?.fullName || "Driver";

    if (toEmail) {
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        driverId: input.driverId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DRIVER_APPROVED,
        templateCode: "driver-rejected",
        subject: "Your driver account application was rejected",
        body: [
          `Hi ${displayName},`,
          "",
          "Your driver account application was rejected.",
          input.reason ? `Reason: ${input.reason}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          driverId: input.driverId,
          reason: input.reason ?? null,
          rejected: true,
        },
      });
    }
  }
}
