import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DisputeCaseModuleBase } from "./base/disputeCase.module.base";
import { DisputeCaseService } from "./disputeCase.service";
import { DisputeCaseController } from "./disputeCase.controller";
import { DisputeCaseResolver } from "./disputeCase.resolver";
import { DisputeCaseDomain } from "src/domain/disputeCase/disputeCase.domain";
import { DisputeCasePolicyService } from "src/domain/disputeCase/disputeCasePolicy.service";
import { DisputeAdminEngine } from "../domain/disputeCase/disputeAdmin.engine";

@Module({
  imports: [DisputeCaseModuleBase, forwardRef(() => AuthModule)],
  controllers: [DisputeCaseController],
  providers: [DisputeCaseService, DisputeCaseResolver, DisputeCaseDomain, DisputeCasePolicyService, DisputeAdminEngine],
  exports: [DisputeCaseService],
})
export class DisputeCaseModule {}
