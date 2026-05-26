// src/domain/appSetting/appSetting.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type AppSettingSelect = Prisma.AppSettingSelect;
type AppSettingWhere = Prisma.AppSettingWhereInput;
type AppSettingWhereUnique = Prisma.AppSettingWhereUniqueInput;
type AppSettingFindMany = Prisma.AppSettingFindManyArgs;
type AppSettingFindUnique = Prisma.AppSettingFindUniqueArgs;

@Injectable()
export class AppSettingDomain extends BaseDomain<
  AppSettingSelect,
  AppSettingWhere,
  AppSettingWhereUnique,
  AppSettingFindMany,
  AppSettingFindUnique
> {
  protected enrichSelectFields: AppSettingSelect = {
    id: true,
    key: true,
    value: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.appSetting);
  }
}