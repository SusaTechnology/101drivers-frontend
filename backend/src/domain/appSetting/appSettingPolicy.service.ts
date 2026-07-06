// src/domain/appSetting/appSettingPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class AppSettingPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.AppSettingCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureRequiredKey(row.key);

    const normalizedKey = String(row.key).trim();
    await this.ensureUniqueKey(client, normalizedKey);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.AppSettingUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "AppSetting id is required for update");

    const existing = await client.appSetting.findUnique({
      where: { id: id! },
      select: {
        id: true,
        key: true,
      },
    });

    this.ensureFound(existing, `AppSetting '${id}' not found`);

    const merged = {
      key: this.resolveUpdatedValue(data.key, existing!.key),
    };

    this.ensureRequiredKey(merged.key);

    const nextKey = String(merged.key).trim();
    if (nextKey !== existing!.key) {
      await this.ensureUniqueKey(client, nextKey, id!);
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "AppSetting id is required for delete");

    const existing = await client.appSetting.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `AppSetting '${id}' not found`);
  }

  private async ensureUniqueKey(
    client: PrismaClient,
    key: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.appSetting.findFirst({
      where: {
        key,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "AppSetting key already exists",
        ErrorCodes.DUPLICATE_ENTRY,
        HttpStatus.CONFLICT
      );
    }
  }

  private ensureRequiredKey(value: unknown): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(
        "key is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureId(id: string | undefined, message: string): void {
    if (!id) {
      throw new AppException(message, ErrorCodes.INVALID_PARAMS);
    }
  }

  private ensureFound(record: any, message: string): void {
    if (!record) {
      throw new AppException(message, ErrorCodes.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
  }

  private resolveUpdatedValue(nextValue: any, currentValue: any): any {
    if (nextValue === undefined) {
      return currentValue;
    }

    if (nextValue && typeof nextValue === "object" && "set" in nextValue) {
      return nextValue.set;
    }

    return nextValue;
  }
}