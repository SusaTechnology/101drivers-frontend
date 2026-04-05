// src/investorLead/investorLead.public.controller.ts

import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { InvestorLeadService } from "./investorLead.service";
import { InvestorLeadCreateInput } from "./base/InvestorLeadCreateInput";
import { InvestorLead } from "./base/InvestorLead";

@swagger.ApiTags("investorLeads-public")
@common.Controller("investorLeads/public")
export class InvestorLeadPublicController {
  constructor(protected readonly service: InvestorLeadService) {}

  @common.Post()
  @swagger.ApiCreatedResponse({ type: InvestorLead })
  async createPublicInvestorLead(
    @common.Body() data: InvestorLeadCreateInput
  ): Promise<InvestorLead> {
    return this.service.createInvestorLead({
      data,
      select: {
        createdAt: true,
        email: true,
        id: true,
        message: true,
        name: true,
        updatedAt: true,
      },
    });
  }
}