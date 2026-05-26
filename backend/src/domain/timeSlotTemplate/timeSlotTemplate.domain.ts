// src/domain/timeSlotTemplate/timeSlotTemplate.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type TimeSlotTemplateSelect = Prisma.TimeSlotTemplateSelect;
type TimeSlotTemplateWhere = Prisma.TimeSlotTemplateWhereInput;
type TimeSlotTemplateWhereUnique = Prisma.TimeSlotTemplateWhereUniqueInput;
type TimeSlotTemplateFindMany = Prisma.TimeSlotTemplateFindManyArgs;
type TimeSlotTemplateFindUnique = Prisma.TimeSlotTemplateFindUniqueArgs;

@Injectable()
export class TimeSlotTemplateDomain extends BaseDomain<
  TimeSlotTemplateSelect,
  TimeSlotTemplateWhere,
  TimeSlotTemplateWhereUnique,
  TimeSlotTemplateFindMany,
  TimeSlotTemplateFindUnique
> {
  protected enrichSelectFields: TimeSlotTemplateSelect = {
    id: true,
    active: true,
    label: true,
    startTime: true,
    endTime: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.timeSlotTemplate);
  }
}