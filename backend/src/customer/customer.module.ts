import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomerModuleBase } from "./base/customer.module.base";
import { CustomerService } from "./customer.service";
import { CustomerController } from "./customer.controller";
import { CustomerResolver } from "./customer.resolver";
import { CustomerPolicyService } from "src/domain/customer/customerPolicy.service";
import { CustomerDomain } from "src/domain/customer/customer.domain";
import { CustomerApprovalEngine } from "src/domain/customer/customerApproval.engine";
import { CustomerPricingEngine } from "src/domain/customer/customerPricing.engine";
import { NotificationEventEngine } from "src/domain/notificationEvent/notificationEvent.engine";
import { MailService } from "src/common/mail/mail.service";
import { PostpaidBillingModule } from "src/postpaidBilling/postpaidBilling.module";

@Module({
  imports: [
    CustomerModuleBase,
    forwardRef(() => AuthModule),
    // Import PostpaidBillingModule so CustomerApprovalEngine can inject
    // PostpaidBillingService — used for auto-setup of the Stripe
    // customer + subscription when an admin approves a BUSINESS customer
    // WITH postpaidEnabled=true. Atomic with rollback to prepaid if the
    // Stripe setup fails (no half-state).
    PostpaidBillingModule,
  ],
  controllers: [CustomerController],
  providers: [
    CustomerService,
    CustomerResolver,
    CustomerDomain,
    CustomerPolicyService,
    CustomerApprovalEngine,
    CustomerPricingEngine,
    NotificationEventEngine,
    MailService
  ],
  exports: [CustomerService],
})
export class CustomerModule {}
