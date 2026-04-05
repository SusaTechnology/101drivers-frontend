import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  EnumCustomerPricingModeOverride,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CustomerPricingEngine {
  constructor(private readonly prisma: PrismaService) {}

  async assignPricing(input: {
    customerId: string;
    pricingConfigId?: string | null;
    pricingModeOverride?: EnumCustomerPricingModeOverride | null;
    postpaidEnabled?: boolean | null;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        pricingConfigId: true,
        pricingModeOverride: true,
        postpaidEnabled: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (customer.customerType !== EnumCustomerCustomerType.BUSINESS) {
      throw new BadRequestException(
        "Custom pricing assignment is only allowed for BUSINESS customers"
      );
    }

    if (
      input.postpaidEnabled === true &&
      customer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
    ) {
      throw new BadRequestException(
        "postpaidEnabled can only be enabled for APPROVED BUSINESS customers"
      );
    }

    if (input.pricingConfigId) {
      const pricingConfig = await this.prisma.pricingConfig.findUnique({
        where: { id: input.pricingConfigId },
        select: { id: true },
      });

      if (!pricingConfig) {
        throw new NotFoundException("PricingConfig not found");
      }
    }

    const beforeJson = customer;

    await this.prisma.customer.update({
      where: { id: input.customerId },
      data: {
        pricingConfig: input.pricingConfigId
          ? { connect: { id: input.pricingConfigId } }
          : input.pricingConfigId === null
          ? { disconnect: true }
          : undefined,
        pricingModeOverride:
          input.pricingModeOverride !== undefined
            ? input.pricingModeOverride
            : undefined,
        postpaidEnabled:
          input.postpaidEnabled !== undefined && input.postpaidEnabled !== null
            ? input.postpaidEnabled
            : undefined,
      },
    });

    const afterCustomer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        pricingConfigId: true,
        pricingModeOverride: true,
        postpaidEnabled: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.PRICING_UPDATE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        customerId: input.customerId,
        reason: input.note ?? "Customer pricing assigned",
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterCustomer ?? Prisma.JsonNull,
      },
    });
  }
}
