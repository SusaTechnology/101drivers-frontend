import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentModuleBase } from "./base/payment.module.base";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { PaymentResolver } from "./payment.resolver";
import { PaymentDomain } from "src/domain/payment/payment.domain";
import { PaymentPolicyService } from "src/domain/payment/paymentPolicy.service";
import { DeliveryLogisticsModule } from "../delivery-logistics/delivery-logistics.module";

@Module({
  imports: [
    PaymentModuleBase,
    forwardRef(() => AuthModule),
    DeliveryLogisticsModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentResolver,
    PaymentDomain,
    
    PaymentPolicyService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}