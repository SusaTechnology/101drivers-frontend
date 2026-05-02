import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryEvidenceModuleBase } from "./base/deliveryEvidence.module.base";
import { DeliveryEvidenceService } from "./deliveryEvidence.service";
import { DeliveryEvidenceController } from "./deliveryEvidence.controller";
import { DeliveryEvidenceResolver } from "./deliveryEvidence.resolver";
import { DeliveryEvidenceDomain } from "src/domain/deliveryEvidence/deliveryEvidence.domain";
import { DeliveryEvidencePolicyService } from "src/domain/deliveryEvidence/deliveryEvidencePolicy.service";
import { DeliveryEvidenceEngine } from "src/domain/deliveryEvidence/deliveryEvidence.engine";

@Module({
  imports: [DeliveryEvidenceModuleBase, forwardRef(() => AuthModule)],
  controllers: [DeliveryEvidenceController],
  providers: [
    DeliveryEvidenceService,
    DeliveryEvidenceResolver,
    DeliveryEvidenceDomain,
    DeliveryEvidencePolicyService,
    DeliveryEvidenceEngine,
  ],
  exports: [DeliveryEvidenceService, DeliveryEvidenceEngine],
})
export class DeliveryEvidenceModule {}