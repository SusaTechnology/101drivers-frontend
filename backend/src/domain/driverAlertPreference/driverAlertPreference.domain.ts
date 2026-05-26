// src/domain/driverAlertPreference/driverAlertPreference.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DriverAlertPreferenceSelect = Prisma.DriverAlertPreferenceSelect;
type DriverAlertPreferenceWhere = Prisma.DriverAlertPreferenceWhereInput;
type DriverAlertPreferenceWhereUnique = Prisma.DriverAlertPreferenceWhereUniqueInput;
type DriverAlertPreferenceFindMany = Prisma.DriverAlertPreferenceFindManyArgs;
type DriverAlertPreferenceFindUnique = Prisma.DriverAlertPreferenceFindUniqueArgs;

@Injectable()
export class DriverAlertPreferenceDomain extends BaseDomain<
  DriverAlertPreferenceSelect,
  DriverAlertPreferenceWhere,
  DriverAlertPreferenceWhereUnique,
  DriverAlertPreferenceFindMany,
  DriverAlertPreferenceFindUnique
> {
  protected enrichSelectFields: DriverAlertPreferenceSelect = {
    id: true,
    driverId: true,
    enabled: true,
    emailEnabled: true,
    smsEnabled: true,
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
    super(prisma.driverAlertPreference);
  }
}