// src/serviceDistrict/serviceDistrict.public.controller.ts

import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { ServiceDistrictService } from "./serviceDistrict.service";
import { ServiceDistrict } from "./base/ServiceDistrict";

@swagger.ApiTags("serviceDistricts-public")
@common.Controller("public/serviceDistricts")
export class ServiceDistrictPublicController {
  constructor(protected readonly service: ServiceDistrictService) {}

  @common.Get()
  @swagger.ApiOkResponse({ type: [ServiceDistrict] })
  async getPublicServiceDistricts(): Promise<ServiceDistrict[]> {
    return this.service.serviceDistricts({
      where: {
        active: true,
      },
      select: {
        active: true,
        code: true,
        createdAt: true,
        geoJson: true,
        id: true,
        name: true,
        updatedAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }
}