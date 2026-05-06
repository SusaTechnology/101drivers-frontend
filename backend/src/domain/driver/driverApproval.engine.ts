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

@Injectable()
export class DriverApprovalEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

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
        subject: "Good news \u2014 we\u2019re now activating new drivers",
        body: [
          `Hi ${displayName},`,
          "",
          "Good news \u2014 we\u2019re now activating new drivers.",
          "To continue, please complete your onboarding by visiting the link below:",
          "",
          `https://${process.env.APP_DOMAIN || 'app.101drivers.com'}/driver-onboarding-complete`,
          "",
          "You will need to provide the following:",
          "",
          "\u2022  Full legal name (exactly as it appears on your driver\u2019s license)",
          "\u2022  Date of birth (MM/DD/YYYY)",
          "\u2022  Social Security Number",
          "\u2022  Current residential address",
          "",
          "Once we receive this, we\u2019ll run your background check and DMV review. We\u2019ll get back to you soon.",
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

    if (driver.status !== EnumDriverStatus.PENDING) {
      throw new BadRequestException("Only pending driver can be rejected");
    }

    const beforeJson = driver;

    await this.prisma.driver.delete({
      where: { id: input.driverId },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DRIVER_APPROVE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        driverId: input.driverId,
        reason: input.reason ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: Prisma.JsonNull,
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