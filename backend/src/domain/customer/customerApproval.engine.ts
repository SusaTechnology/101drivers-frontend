import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumCustomerApprovalStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";

@Injectable()
export class CustomerApprovalEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

  async approveCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    postpaidEnabled?: boolean;
    note?: string | null;
  }): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        postpaidEnabled: true,
        suspendedAt: true,
        suspensionReason: true,
        contactEmail: true,
        contactName: true,
        businessName: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (customer.approvalStatus === EnumCustomerApprovalStatus.APPROVED) {
      throw new BadRequestException("Customer is already approved");
    }

    const beforeJson = customer;
    const approvedAt = new Date();

    await this.prisma.customer.update({
      where: { id: input.customerId },
      data: {
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
        approvedAt,
        approvedBy: input.actorUserId
          ? { connect: { id: input.actorUserId } }
          : undefined,
        postpaidEnabled: input.postpaidEnabled === true,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    const afterCustomer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        postpaidEnabled: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DEALER_APPROVE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        customerId: input.customerId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterCustomer ?? Prisma.JsonNull,
      },
    });

    const toEmail =
      customer.contactEmail?.trim().toLowerCase() ||
      customer.user?.email?.trim().toLowerCase() ||
      null;

    if (toEmail) {
      const displayName =
        customer.businessName ||
        customer.contactName ||
        customer.user?.fullName ||
        "Customer";

      const subject =
        customer.customerType === "BUSINESS"
          ? "Your dealer account has been approved"
          : "Your customer account has been approved";

      const approvalLine =
        customer.customerType === "BUSINESS"
          ? customer.businessName
            ? `Your dealer account for ${customer.businessName} has been approved.`
            : "Your dealer account has been approved."
          : "Your customer account has been approved.";

      const loginLine =
        customer.customerType === "BUSINESS"
          ? "You can now log in and start creating delivery requests."
          : "You can now log in and continue using your account.";

      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        customerId: input.customerId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DEALER_APPROVED,
        templateCode: "dealer-approved",
        subject,
        body: [
          `Hi ${displayName},`,
          "",
          approvalLine,
          input.postpaidEnabled === true
            ? "Postpaid billing has been enabled for your account."
            : "",
          loginLine,
          input.note ? `Note: ${input.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        toEmail,
        payload: {
          customerId: input.customerId,
          customerType: customer.customerType,
          postpaidEnabled: input.postpaidEnabled === true,
          approvedAt: afterCustomer?.approvedAt ?? approvedAt,
          note: input.note ?? null,
        },
      });
    }
  }

  async rejectCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        postpaidEnabled: true,
        contactEmail: true,
        businessName: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (customer.approvalStatus === EnumCustomerApprovalStatus.REJECTED) {
      throw new BadRequestException("Customer is already rejected");
    }

    const beforeJson = customer;

    await this.prisma.customer.update({
      where: { id: input.customerId },
      data: {
        approvalStatus: EnumCustomerApprovalStatus.REJECTED,
        approvedAt: null,
        approvedBy: { disconnect: true },
        postpaidEnabled: false,
      },
    });

    const afterCustomer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        postpaidEnabled: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DEALER_REJECT,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        customerId: input.customerId,
        reason: input.reason ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterCustomer ?? Prisma.JsonNull,
      },
    });
  }

  async suspendCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    reason: string;
  }): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        postpaidEnabled: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const beforeJson = customer;

    await this.prisma.customer.update({
      where: { id: input.customerId },
      data: {
        approvalStatus: EnumCustomerApprovalStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspensionReason: input.reason,
        postpaidEnabled: false,
      },
    });

    const afterCustomer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        approvalStatus: true,
        postpaidEnabled: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        customerId: input.customerId,
        reason: input.reason,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterCustomer ?? Prisma.JsonNull,
      },
    });
  }

  async unsuspendCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        approvalStatus: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const beforeJson = customer;

    await this.prisma.customer.update({
      where: { id: input.customerId },
      data: {
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    const afterCustomer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        approvalStatus: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        customerId: input.customerId,
        reason: input.note ?? null,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterCustomer ?? Prisma.JsonNull,
      },
    });
  }
}