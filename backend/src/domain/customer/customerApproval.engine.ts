import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumCustomerApprovalStatus,
  EnumCustomerBillingMode,
  EnumCustomerCustomerType,
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";
import { PostpaidBillingService } from "../../postpaidBilling/postpaidBilling.service";

@Injectable()
export class CustomerApprovalEngine {
  private readonly logger = new Logger(CustomerApprovalEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine,
    // Inject PostpaidBillingService so we can auto-setup the Stripe
    // customer + subscription when an admin approves a BUSINESS customer
    // WITH postpaidEnabled=true. This guarantees the invariant:
    //
    //   approvalStatus = APPROVED + postpaidEnabled = true
    //     → billingMode = WEEKLY_POSTPAID
    //     → stripeSubscriptionId IS NOT NULL
    //
    // Without this, the admin could approve a customer as postpaid and
    // navigate away from the page without setting up Stripe — leaving
    // the customer in a half-state (postpaidEnabled=true but no
    // subscription → can't create deliveries, no weekly invoices).
    // @Optional() guards against circular-DI issues during testing
    // (the service may not be available in unit-test context).
    @Optional() private readonly postpaidBilling?: PostpaidBillingService,
  ) {}

  async approveCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    postpaidEnabled?: boolean;
    note?: string | null;
    /**
     * Optional: if provided, the warning message will be stored here
     * so the caller (CustomerService.approveCustomer) can return it to
     * the API layer for the admin to see. Used when the admin approves
     * a customer as postpaid but the Stripe auto-setup fails — the
     * customer is approved as prepaid instead, and the warning explains
     * why and how to fix it.
     */
    onPostpaidSetupWarning?: (warning: string) => void;
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

    // ── Determine the billing mode for this approval ──────────────────
    //
    // If admin approves a BUSINESS customer WITH postpaidEnabled=true, we
    // need to:
    //   (a) set billingMode = WEEKLY_POSTPAID on the customer row
    //   (b) auto-create the Stripe customer + $0/week subscription
    //
    // This is the "big system" atomic pattern: the approval + setup
    // happen together. If setup fails, we ROLL BACK the approval to
    // PREPAID (postpaidEnabled=false, billingMode=PREPAID_INSTANT) so
    // there's no half-state.
    //
    // Why rollback-to-prepaid instead of failing the approval entirely:
    //   • The admin's primary intent is "approve this customer" — they
    //     want the customer to be able to use the platform.
    //   • Postpaid is a secondary flag. If it can't be set up (e.g.
    //     Stripe is unavailable), we still approve the customer as
    //     prepaid so they can start using the platform immediately.
    //   • The admin sees a clear warning toast and can re-switch to
    //     postpaid later when the underlying issue is fixed.
    //
    // Note: setupDealerForPostpaid requires APPROVED status + a contact
    // email. We set APPROVED FIRST, then call setup. If setup fails
    // because there's no contact email, we rollback to prepaid (the
    // admin should add a contact email first, then re-switch to postpaid
    // via the Billing Mode card on the user-detail page).
    const wantsPostpaid =
      input.postpaidEnabled === true &&
      customer.customerType === EnumCustomerCustomerType.BUSINESS;

    // Step 1: approve the customer + set the billing mode flag.
    await this.prisma.customer.update({
      where: { id: input.customerId },
      data: {
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
        approvedAt,
        approvedBy: input.actorUserId
          ? { connect: { id: input.actorUserId } }
          : undefined,
        postpaidEnabled: wantsPostpaid,
        // Set billingMode atomically with postpaidEnabled so they
        // can't drift apart. PREPAID_INSTANT is the default for
        // non-postpaid approvals; WEEKLY_POSTPAID is set for postpaid
        // approvals (and may be rolled back below if setup fails).
        billingMode: wantsPostpaid
          ? EnumCustomerBillingMode.WEEKLY_POSTPAID
          : EnumCustomerBillingMode.PREPAID_INSTANT,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    // Step 2: if approving as postpaid, auto-create the Stripe customer
    // + subscription. Roll back to prepaid if setup fails so there's
    // no half-state. The admin sees a clear warning toast and can
    // re-switch to postpaid later.
    let postpaidSetupWarning: string | null = null;
    if (wantsPostpaid) {
      if (!this.postpaidBilling) {
        // PostpaidBillingService not injected — likely a unit-test
        // context. Roll back to prepaid so we don't leave a half-state.
        postpaidSetupWarning =
          "Postpaid billing setup is unavailable on the server. " +
          "Customer was approved as Prepaid. Fix the server config and " +
          "switch to Postpaid via the admin user-detail page.";
        await this.rollbackToPrepaid(input.customerId);
        this.logger.error(
          `approveCustomer: PostpaidBillingService not injected — rolled back customer ${input.customerId} to prepaid`,
        );
      } else {
        try {
          await this.postpaidBilling.setupDealerForPostpaid(input.customerId);
          this.logger.log(
            `approveCustomer: auto-setup completed for customer ${input.customerId} (postpaid)`,
          );
        } catch (err: any) {
          postpaidSetupWarning =
            `Postpaid billing setup failed: ${err.message}. ` +
            `Customer was approved as Prepaid. Fix the underlying issue ` +
            `(e.g. add a contact email, check Stripe config) and switch ` +
            `to Postpaid via the admin user-detail page.`;
          await this.rollbackToPrepaid(input.customerId);
          this.logger.error(
            `approveCustomer: auto-setup failed for customer ${input.customerId}: ${err.message} — rolled back to prepaid`,
            err?.stack,
          );
        }
      }
    }

    // Surface the warning to the caller so it can be returned in the
    // API response — the admin frontend shows a toast based on this.
    if (postpaidSetupWarning && input.onPostpaidSetupWarning) {
      input.onPostpaidSetupWarning(postpaidSetupWarning);
    }

    const afterCustomer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        postpaidEnabled: true,
        billingMode: true,
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

  // ── Helper: roll back a customer to prepaid billing state ────────
  //
  // Called when auto-setup of Stripe customer + subscription fails
  // during approval. Sets the customer to:
  //   • postpaidEnabled = false
  //   • billingMode = PREPAID_INSTANT
  //
  // so they can use the platform as a prepaid customer immediately.
  // The admin sees a warning toast and can re-switch to postpaid
  // via the Billing Mode card on the user-detail page once the
  // underlying issue is fixed.
  //
  // Does NOT clear stripeCustomerId / stripeDefaultPaymentMethodId —
  // if those exist (e.g. from a previous setup attempt), they're
  // still useful for prepaid charges.
  private async rollbackToPrepaid(customerId: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        postpaidEnabled: false,
        billingMode: EnumCustomerBillingMode.PREPAID_INSTANT,
      },
    });
  }
}