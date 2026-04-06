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

  @common.Get('check')
  @swagger.ApiQuery({ name: 'lat', type: Number, required: true })
  @swagger.ApiQuery({ name: 'lng', type: Number, required: true })
  async checkPickupZone(
    @common.Query('lat') lat: number,
    @common.Query('lng') lng: number,
  ): Promise<{ inZone: boolean; zones: Array<{ id: string; code: string; name: string }> }> {
    return this.service.checkPointInPickupZones(lat, lng);
  }
}