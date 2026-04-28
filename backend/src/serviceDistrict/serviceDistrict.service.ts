// src/serviceDistrict/serviceDistrict.service.ts

import { Injectable } from "@nestjs/common";
import {
  DriverDistrictPreference as PrismaDriverDistrictPreference,
  Prisma,
  ServiceDistrict as PrismaServiceDistrict,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { ServiceDistrictServiceBase } from "./base/serviceDistrict.service.base";
import { ServiceDistrictDomain } from "../domain/serviceDistrict/serviceDistrict.domain";
import { ServiceDistrictPolicyService } from "../domain/serviceDistrict/serviceDistrictPolicy.service";

@Injectable()
export class ServiceDistrictService extends ServiceDistrictServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: ServiceDistrictDomain,
    private readonly policy: ServiceDistrictPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.ServiceDistrictCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.serviceDistrict.count(args);
  }

  async serviceDistricts(args: Prisma.ServiceDistrictFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async serviceDistrict(args: Prisma.ServiceDistrictFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createServiceDistrict(args: Prisma.ServiceDistrictCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.serviceDistrict.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateServiceDistrict(args: Prisma.ServiceDistrictUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.serviceDistrict.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteServiceDistrict(
    args: Prisma.ServiceDistrictDeleteArgs
  ): Promise<PrismaServiceDistrict> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.serviceDistrict.delete(args);
  }

  async findDriverPrefs(
    parentId: string,
    args: Prisma.DriverDistrictPreferenceFindManyArgs
  ): Promise<PrismaDriverDistrictPreference[]> {
    return this.prisma.serviceDistrict
      .findUniqueOrThrow({ where: { id: parentId } })
      .driverPrefs(args);
  }

  private normalizeCreateData(
    data: Prisma.ServiceDistrictCreateArgs["data"]
  ): Prisma.ServiceDistrictCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.code = this.trimRequiredString(normalized.code).toUpperCase();
    normalized.name = this.trimRequiredString(normalized.name);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.ServiceDistrictUpdateArgs["data"]
  ): Prisma.ServiceDistrictUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateCodeField(normalized, "code");
    this.normalizeUpdateStringField(normalized, "name");

    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim();
  }

  private normalizeUpdateCodeField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      if (raw.set == null) {
        delete target[field];
        return;
      }
      target[field] = {
        ...raw,
        set: this.trimRequiredString(raw.set).toUpperCase(),
      };
      return;
    }

    if (raw == null) {
      delete target[field];
      return;
    }

    target[field] = this.trimRequiredString(raw).toUpperCase();
  }

  async checkPointInPickupZones(
    lat: number,
    lng: number,
  ): Promise<{ inZone: boolean; zones: Array<{ id: string; code: string; name: string }> }> {
    const districts = await this.prisma.serviceDistrict.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, geoJson: true },
    });

    const matchingZones: Array<{ id: string; code: string; name: string }> = [];

    // GeoJSON coordinates use [lng, lat] order; our API uses (lat, lng)
    const point: [number, number] = [lng, lat];

    for (const district of districts) {
      if (!district.geoJson) continue;

      const geo = district.geoJson as any;

      try {
        const polygon: [number, number][] = geo?.geometry?.coordinates?.[0];
        if (!polygon || !Array.isArray(polygon)) continue;

        if (pointInPolygon(point, polygon)) {
          matchingZones.push({
            id: district.id,
            code: district.code,
            name: district.name,
          });
        }
      } catch {
        // Skip districts with malformed geoJson
        continue;
      }
    }

    return {
      inZone: matchingZones.length > 0,
      zones: matchingZones,
    };
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      if (raw.set == null) {
        delete target[field];
        return;
      }
      target[field] = {
        ...raw,
        set: this.trimRequiredString(raw.set),
      };
      return;
    }

    if (raw == null) {
      delete target[field];
      return;
    }

    target[field] = this.trimRequiredString(raw);
  }
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}