// PostpaidBillingModule — wires together the engine service + admin
// controller. The Stripe webhook integration is handled in the existing
// StripeWebhookController (we add 3 case statements there), so this module
// exports the service so the webhook controller can inject it.

import { Module } from "@nestjs/common";
import { PostpaidBillingController } from "./postpaidBilling.controller";
import { PostpaidBillingService } from "./postpaidBilling.service";

@Module({
  controllers: [PostpaidBillingController],
  providers: [PostpaidBillingService],
  exports: [PostpaidBillingService],
})
export class PostpaidBillingModule {}
