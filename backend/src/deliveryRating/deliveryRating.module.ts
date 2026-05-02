import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryRatingModuleBase } from "./base/deliveryRating.module.base";
import { DeliveryRatingService } from "./deliveryRating.service";
import { DeliveryRatingController } from "./deliveryRating.controller";
import { DeliveryRatingResolver } from "./deliveryRating.resolver";
import { DeliveryRatingDomain } from "src/domain/deliveryRating/deliveryRating.domain";
import { DeliveryRatingPolicyService } from "src/domain/deliveryRating/deliveryRatingPolicy.service";

@Module({
  imports: [DeliveryRatingModuleBase, forwardRef(() => AuthModule)],
  controllers: [DeliveryRatingController],
  providers: [DeliveryRatingService, DeliveryRatingResolver, DeliveryRatingDomain, DeliveryRatingPolicyService],
  exports: [DeliveryRatingService],
})
export class DeliveryRatingModule {}
