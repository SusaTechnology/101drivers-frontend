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

@Module({
  imports: [CustomerModuleBase, forwardRef(() => AuthModule)],
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
