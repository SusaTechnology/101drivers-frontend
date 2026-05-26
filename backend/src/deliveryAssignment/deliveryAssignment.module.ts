import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryAssignmentModuleBase } from "./base/deliveryAssignment.module.base";
import { DeliveryAssignmentService } from "./deliveryAssignment.service";
import { DeliveryAssignmentController } from "./deliveryAssignment.controller";
import { DeliveryAssignmentResolver } from "./deliveryAssignment.resolver";
import { DeliveryAssignmentDomain } from "src/domain/deliveryAssignment/deliveryAssignment.domain";
import { DeliveryAssignmentPolicyService } from "src/domain/deliveryAssignment/deliveryAssignmentPolicy.service";

@Module({
  imports: [DeliveryAssignmentModuleBase, forwardRef(() => AuthModule)],
  controllers: [DeliveryAssignmentController],
  providers: [DeliveryAssignmentService, DeliveryAssignmentResolver, DeliveryAssignmentDomain, DeliveryAssignmentPolicyService
  ],
  exports: [DeliveryAssignmentService],
})
export class DeliveryAssignmentModule {}
