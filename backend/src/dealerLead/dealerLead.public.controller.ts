// src/dealerLead/dealerLead.public.controller.ts

import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { DealerLeadService } from "./dealerLead.service";
import { DealerLeadCreateInput } from "./base/DealerLeadCreateInput";
import { DealerLead } from "./base/DealerLead";

@swagger.ApiTags("dealerLeads-public")
@common.Controller("dealerLeads/public")
export class DealerLeadPublicController {
  constructor(protected readonly service: DealerLeadService) {}

  @common.Post()
  @swagger.ApiCreatedResponse({ type: DealerLead })
  async createPublicDealerLead(
    @common.Body() data: DealerLeadCreateInput
  ): Promise<DealerLead> {
    return this.service.createDealerLead({
      data,
      select: {
        businessName: true,
        createdAt: true,
        email: true,
        id: true,
        message: true,
        phone: true,
        updatedAt: true,
      },
    });
  }
}