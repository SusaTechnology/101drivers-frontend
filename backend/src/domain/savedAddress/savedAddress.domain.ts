// src/domain/savedAddress/savedAddress.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type SavedAddressSelect = Prisma.SavedAddressSelect;
type SavedAddressWhere = Prisma.SavedAddressWhereInput;
type SavedAddressWhereUnique = Prisma.SavedAddressWhereUniqueInput;
type SavedAddressFindMany = Prisma.SavedAddressFindManyArgs;
type SavedAddressFindUnique = Prisma.SavedAddressFindUniqueArgs;

@Injectable()
export class SavedAddressDomain extends BaseDomain<
  SavedAddressSelect,
  SavedAddressWhere,
  SavedAddressWhereUnique,
  SavedAddressFindMany,
  SavedAddressFindUnique
> {
  protected enrichSelectFields: SavedAddressSelect = {
    id: true,
    customerId: true,
    label: true,
    address: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    lat: true,
    lng: true,
    placeId: true,
    isDefault: true,
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

    defaultForCustomers: {
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

    _count: {
      select: {
        defaultForCustomers: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.savedAddress);
  }
}