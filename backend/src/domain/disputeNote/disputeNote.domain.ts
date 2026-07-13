// src/domain/disputeNote/disputeNote.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DisputeNoteSelect = Prisma.DisputeNoteSelect;
type DisputeNoteWhere = Prisma.DisputeNoteWhereInput;
type DisputeNoteWhereUnique = Prisma.DisputeNoteWhereUniqueInput;
type DisputeNoteFindMany = Prisma.DisputeNoteFindManyArgs;
type DisputeNoteFindUnique = Prisma.DisputeNoteFindUniqueArgs;

@Injectable()
export class DisputeNoteDomain extends BaseDomain<
  DisputeNoteSelect,
  DisputeNoteWhere,
  DisputeNoteWhereUnique,
  DisputeNoteFindMany,
  DisputeNoteFindUnique
> {
  protected enrichSelectFields: DisputeNoteSelect = {
    id: true,
    disputeId: true,
    authorUserId: true,
    note: true,
    createdAt: true,
    updatedAt: true,

    author: {
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

    dispute: {
      select: {
        id: true,
        deliveryId: true,
        reason: true,
        legalHold: true,
        status: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.disputeNote);
  }
}