// src/domain/savedVehicle/savedVehicle.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type SavedVehicleSelect = Prisma.SavedVehicleSelect;
type SavedVehicleWhere = Prisma.SavedVehicleWhereInput;
type SavedVehicleWhereUnique = Prisma.SavedVehicleWhereUniqueInput;
type SavedVehicleFindMany = Prisma.SavedVehicleFindManyArgs;
type SavedVehicleFindUnique = Prisma.SavedVehicleFindUniqueArgs;

@Injectable()
export class SavedVehicleDomain extends BaseDomain<
  SavedVehicleSelect,
  SavedVehicleWhere,
  SavedVehicleWhereUnique,
  SavedVehicleFindMany,
  SavedVehicleFindUnique
> {
  protected enrichSelectFields: SavedVehicleSelect = {
    id: true,
    customerId: true,
    licensePlate: true,
    make: true,
    model: true,
    color: true,
    createdAt: true,
    updatedAt: true,

    customer: {
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        phone: true,
        defaultPickupId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.savedVehicle);
  }
}