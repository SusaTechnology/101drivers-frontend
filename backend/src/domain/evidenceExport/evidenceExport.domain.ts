// src/domain/evidenceExport/evidenceExport.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type EvidenceExportSelect = Prisma.EvidenceExportSelect;
type EvidenceExportWhere = Prisma.EvidenceExportWhereInput;
type EvidenceExportWhereUnique = Prisma.EvidenceExportWhereUniqueInput;
type EvidenceExportFindMany = Prisma.EvidenceExportFindManyArgs;
type EvidenceExportFindUnique = Prisma.EvidenceExportFindUniqueArgs;

@Injectable()
export class EvidenceExportDomain extends BaseDomain<
  EvidenceExportSelect,
  EvidenceExportWhere,
  EvidenceExportWhereUnique,
  EvidenceExportFindMany,
  EvidenceExportFindUnique
> {
  protected enrichSelectFields: EvidenceExportSelect = {
    id: true,
    deliveryId: true,
    createdByUserId: true,
    url: true,
    metaJson: true,
    createdAt: true,
    updatedAt: true,

    createdBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.evidenceExport);
  }
}