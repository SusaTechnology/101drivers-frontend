import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DealerLeadModuleBase } from "./base/dealerLead.module.base";
import { DealerLeadService } from "./dealerLead.service";
import { DealerLeadController } from "./dealerLead.controller";
import { DealerLeadResolver } from "./dealerLead.resolver";
import { DealerLeadDomain } from "src/domain/dealerLead/dealerLead.domain";
import { DealerLeadPolicyService } from "src/domain/dealerLead/dealerLeadPolicy.service";
import { DealerLeadPublicController } from "./dealerLead.public.controller";

@Module({
  imports: [DealerLeadModuleBase, forwardRef(() => AuthModule)],
  controllers: [DealerLeadController, DealerLeadPublicController],
  providers: [DealerLeadService, DealerLeadResolver, DealerLeadDomain, DealerLeadPolicyService],
  exports: [DealerLeadService],
})
export class DealerLeadModule {}
