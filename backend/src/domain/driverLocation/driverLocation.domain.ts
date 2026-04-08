import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DriverLocationSelect = Prisma.DriverLocationSelect;
type DriverLocationWhere = Prisma.DriverLocationWhereInput;
type DriverLocationWhereUnique = Prisma.DriverLocationWhereUniqueInput;
type DriverLocationFindMany = Prisma.DriverLocationFindManyArgs;
type DriverLocationFindUnique = Prisma.DriverLocationFindUniqueArgs;

@Injectable()
export class DriverLocationDomain extends BaseDomain<
  DriverLocationSelect,
  DriverLocationWhere,
  DriverLocationWhereUnique,
  DriverLocationFindMany,
  DriverLocationFindUnique
> {
  protected enrichSelectFields: DriverLocationSelect = {
    id: true,
    driverId: true,
    currentLat: true,
    currentLng: true,
    currentAt: true,
    homeBaseLat: true,
    homeBaseLng: true,
    homeBaseCity: true,
    homeBaseState: true,
    createdAt: true,
    updatedAt: true,

    driver: {
      select: {
        id: true,
        userId: true,
        phone: true,
        status: true,
        approvedAt: true,
        profilePhotoUrl: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            phone: true,
            roles: true,
            isActive: true,
            emailVerifiedAt: true,
            disabledAt: true,
            disabledReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.driverLocation);
  }
}
