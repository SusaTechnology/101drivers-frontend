// src/domain/serviceDistrict/serviceDistrict.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type ServiceDistrictSelect = Prisma.ServiceDistrictSelect;
type ServiceDistrictWhere = Prisma.ServiceDistrictWhereInput;
type ServiceDistrictWhereUnique = Prisma.ServiceDistrictWhereUniqueInput;
type ServiceDistrictFindMany = Prisma.ServiceDistrictFindManyArgs;
type ServiceDistrictFindUnique = Prisma.ServiceDistrictFindUniqueArgs;

@Injectable()
export class ServiceDistrictDomain extends BaseDomain<
  ServiceDistrictSelect,
  ServiceDistrictWhere,
  ServiceDistrictWhereUnique,
  ServiceDistrictFindMany,
  ServiceDistrictFindUnique
> {
  protected enrichSelectFields: ServiceDistrictSelect = {
    id: true,
    code: true,
    name: true,
    active: true,
    geoJson: true,
    createdAt: true,
    updatedAt: true,

    driverPrefs: {
      select: {
        id: true,
        driverId: true,
        districtId: true,
        createdAt: true,
        updatedAt: true,
        driver: {
          select: {
            id: true,
            userId: true,
            status: true,
            phone: true,
            approvedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    },

    _count: {
      select: {
        driverPrefs: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.serviceDistrict);
  }
}