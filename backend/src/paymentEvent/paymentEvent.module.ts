import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentEventModuleBase } from "./base/paymentEvent.module.base";
import { PaymentEventService } from "./paymentEvent.service";
import { PaymentEventController } from "./paymentEvent.controller";
import { PaymentEventResolver } from "./paymentEvent.resolver";
import { PaymentEventDomain } from "src/domain/paymentEvent/paymentEvent.domain";
import { PaymentEventPolicyService } from "src/domain/paymentEvent/paymentEventPolicy.service";

@Module({
  imports: [PaymentEventModuleBase, forwardRef(() => AuthModule)],
  controllers: [PaymentEventController],
  providers: [PaymentEventService, PaymentEventResolver, PaymentEventDomain, PaymentEventPolicyService],
  exports: [PaymentEventService],
})
export class PaymentEventModule {}
