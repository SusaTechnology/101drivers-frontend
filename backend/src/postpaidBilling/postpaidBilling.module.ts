// PostpaidBillingModule — wires together the engine service + admin
// controller. The Stripe webhook integration is handled in the existing
// StripeWebhookController (we add 3 case statements there), so this module
// exports the service so the webhook controller can inject it.

import { Module } from "@nestjs/common";
import { PostpaidBillingController } from "./postpaidBilling.controller";
import { PostpaidBillingService } from "./postpaidBilling.service";
// TS-level import only — NO module import (that would close a DI cycle:
// postpaidBilling → referral → driverPayout → delivery-logistics → postpaidBilling).
// Nest instantiates the class here with the global PrismaService + StripeService.
import { ReferralCreditApplicationService } from "../referral/referral-credit-application.service";

@Module({
  controllers: [PostpaidBillingController],
  providers: [PostpaidBillingService, ReferralCreditApplicationService],
  exports: [PostpaidBillingService],
})
export class PostpaidBillingModule {}
