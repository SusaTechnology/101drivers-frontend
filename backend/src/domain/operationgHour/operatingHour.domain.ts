// src/domain/operatingHour/operatingHour.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type OperatingHourSelect = Prisma.OperatingHourSelect;
type OperatingHourWhere = Prisma.OperatingHourWhereInput;
type OperatingHourWhereUnique = Prisma.OperatingHourWhereUniqueInput;
type OperatingHourFindMany = Prisma.OperatingHourFindManyArgs;
type OperatingHourFindUnique = Prisma.OperatingHourFindUniqueArgs;

@Injectable()
export class OperatingHourDomain extends BaseDomain<
  OperatingHourSelect,
  OperatingHourWhere,
  OperatingHourWhereUnique,
  OperatingHourFindMany,
  OperatingHourFindUnique
> {
  protected enrichSelectFields: OperatingHourSelect = {
    id: true,
    active: true,
    dayOfWeek: true,
    startTime: true,
    endTime: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.operatingHour);
  }
}