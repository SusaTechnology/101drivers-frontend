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

  /**
   * Bulk-assign a single pricing config to many customers.
   *
   * Iterates over customerIds, calling the existing assignPricing logic
   * for each. Failures are collected per-customer and returned — the
   * operation does NOT abort on the first failure (skip-and-report).
   * This gives the admin partial success with full transparency: they
   * see exactly which customers were assigned and which failed (with
   * reasons), so they can fix the bad ones and re-run just those.
   *
   * Each successful assignment writes its own AdminAuditLog entry
   * (same as the single-customer path), so the audit trail is
   * per-customer and identical to doing N individual assignments.
   *
   * Returns: { assigned: number, failed: Array<{customerId, error}> }
   */
  async bulkAssignPricing(input: {
    pricingConfigId: string;
    customerIds: string[];
    pricingModeOverride?: EnumCustomerPricingModeOverride | null;
    postpaidEnabled?: boolean | null;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<{
    assigned: number;
    failed: Array<{ customerId: string; error: string }>;
  }> {
    // Validate the pricing config once up front — if it doesn't exist,
    // every customer assignment would fail with the same error, so fail
    // fast with a clear message.
    const config = await this.prisma.pricingConfig.findUnique({
      where: { id: input.pricingConfigId },
      select: { id: true },
    });
    if (!config) {
      throw new NotFoundException(
        `PricingConfig not found: ${input.pricingConfigId}`,
      );
    }

    let assigned = 0;
    const failed: Array<{ customerId: string; error: string }> = [];

    for (const customerId of input.customerIds) {
      try {
        await this.assignPricing({
          customerId,
          pricingConfigId: input.pricingConfigId,
          pricingModeOverride: input.pricingModeOverride ?? undefined,
          postpaidEnabled: input.postpaidEnabled ?? undefined,
          actorUserId: input.actorUserId ?? null,
          note: input.note ?? null,
        });
        assigned += 1;
      } catch (err) {
        failed.push({
          customerId,
          error:
            err instanceof Error ? err.message : "Unknown error during assignment",
        });
      }
    }

    return { assigned, failed };
  }
}
