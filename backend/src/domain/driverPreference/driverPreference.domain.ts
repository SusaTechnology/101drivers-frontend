// src/domain/driverPreference/driverPreference.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DriverPreferenceSelect = Prisma.DriverPreferenceSelect;
type DriverPreferenceWhere = Prisma.DriverPreferenceWhereInput;
type DriverPreferenceWhereUnique = Prisma.DriverPreferenceWhereUniqueInput;
type DriverPreferenceFindMany = Prisma.DriverPreferenceFindManyArgs;
type DriverPreferenceFindUnique = Prisma.DriverPreferenceFindUniqueArgs;

@Injectable()
export class DriverPreferenceDomain extends BaseDomain<
  DriverPreferenceSelect,
  DriverPreferenceWhere,
  DriverPreferenceWhereUnique,
  DriverPreferenceFindMany,
  DriverPreferenceFindUnique
> {
  protected enrichSelectFields: DriverPreferenceSelect = {
    id: true,
    driverId: true,
    city: true,
    radiusMiles: true,
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
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.driverPreference);
  }
}