import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvestorLeadModuleBase } from "./base/investorLead.module.base";
import { InvestorLeadService } from "./investorLead.service";
import { InvestorLeadController } from "./investorLead.controller";
import { InvestorLeadResolver } from "./investorLead.resolver";
import { InvestorLeadDomain } from "src/domain/investorLead/investorLead.domain";
import { InvestorLeadPolicyService } from "src/domain/investorLead/investorLeadPolicy.service";
import { InvestorLeadPublicController } from "./investorLead.public.controller";

@Module({
  imports: [InvestorLeadModuleBase, forwardRef(() => AuthModule)],
  controllers: [InvestorLeadController, InvestorLeadPublicController],
  providers: [InvestorLeadService, InvestorLeadResolver, InvestorLeadDomain, InvestorLeadPolicyService],
  exports: [InvestorLeadService],
})
export class InvestorLeadModule {}
