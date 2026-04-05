// src/domain/driverDistrictPreference/driverDistrictPreference.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DriverDistrictPreferenceSelect = Prisma.DriverDistrictPreferenceSelect;
type DriverDistrictPreferenceWhere = Prisma.DriverDistrictPreferenceWhereInput;
type DriverDistrictPreferenceWhereUnique = Prisma.DriverDistrictPreferenceWhereUniqueInput;
type DriverDistrictPreferenceFindMany = Prisma.DriverDistrictPreferenceFindManyArgs;
type DriverDistrictPreferenceFindUnique = Prisma.DriverDistrictPreferenceFindUniqueArgs;

@Injectable()
export class DriverDistrictPreferenceDomain extends BaseDomain<
  DriverDistrictPreferenceSelect,
  DriverDistrictPreferenceWhere,
  DriverDistrictPreferenceWhereUnique,
  DriverDistrictPreferenceFindMany,
  DriverDistrictPreferenceFindUnique
> {
  protected enrichSelectFields: DriverDistrictPreferenceSelect = {
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
        profilePhotoUrl: true,
        approvedAt: true,
        approvedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    district: {
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        geoJson: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.driverDistrictPreference);
  }
}