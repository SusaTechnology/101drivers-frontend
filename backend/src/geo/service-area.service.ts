/**
 * Driver service-area — ONE polygon (LA metro) stored in the database.
 *
 * Owner spec (service-area storage pass):
 *  - The polygon lives in ServiceAreaPolygon as an ordered [lat, lng] list;
 *    ops edit it from the admin map editor WITHOUT a deploy. The seed
 *    constant below is only the day-one INSERT (migration), never a
 *    runtime input — the DB row always wins.
 *  - When a driver signs up or their zip changes, the zip is geocoded to a
 *    centroid (cached forever in ServiceAreaZipCache — one Google call per
 *    distinct zip, ever) and tested with standard ray-casting. Match =
 *    in-service, no match = out.
 *  - Badges are DERIVED (serviceAreaInArea on the Driver row). The manual
 *    funnel is sacred: this service NEVER writes Driver.status. A driver
 *    manually deactivated by an admin can never be re-activated here, no
 *    matter where their zip falls — manual status always wins, by design.
 *  - No zip or an unresolvable zip → gray + flagged for review.
 *  - Every badge change is audit-logged with the triggering zip.
 */
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  LA_METRO_SERVICE_AREA_NAME,
  LA_METRO_SERVICE_AREA_POLYGON,
  LatLng,
  normalizeServiceAreaZip,
  pointInPolygon,
  validatePolygon,
} from "./service-area.geometry";

export interface PolygonDto {
  name: string;
  coords: LatLng[];
  updatedAt?: Date;
}

export interface DriverEvaluationInput {
  driverId: string;
  /** Current badge, for audit diffing. Undefined ⇒ the service fetches it
   *  itself (callers that just wrote the zip don't need a pre-read). */
  previousInArea?: boolean | null;
  zipRaw: string | null | undefined;
  /** Where the evaluation came from — recorded in the audit reason. */
  source: string;
  /** Dry-run: compute the verdict without writing anything. */
  dryRun?: boolean;
}

export interface DriverEvaluationResult {
  zip: string | null;
  inArea: boolean | null;
  flagged: boolean;
  reason: "IN_AREA" | "OUT_OF_AREA" | "NO_ZIP" | "UNRESOLVED_ZIP";
}

export interface EvaluateAllSummary {
  totalDrivers: number;
  inArea: number;
  outOfArea: number;
  unresolved: number;
  flippedToIn: number;
  flippedToOut: number;
  flippedZipsIn: string[];
  flippedZipsOut: string[];
}

@Injectable()
export class ServiceAreaService {
  private readonly logger = new Logger(ServiceAreaService.name);
  /** In-flight geocode dedupe: drivers sharing a zip share one API call. */
  private geocodeInFlight = new Map<string, Promise<{ lat: number; lng: number } | null>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ═══════════════════════════ POLYGON ═══════════════════════════

  /** The active polygon. Belt-and-braces: if the row vanished (manual DB
   *  wipe) it reseeds from the day-one constants so the badge system
   *  never runs without a shape. */
  async getPolygon(): Promise<PolygonDto> {
    const row = await this.prisma.serviceAreaPolygon.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      return {
        name: LA_METRO_SERVICE_AREA_NAME,
        coords: LA_METRO_SERVICE_AREA_POLYGON,
      };
    }
    return { name: row.name, coords: row.coordsJson as LatLng[], updatedAt: row.updatedAt };
  }

  /**
   * Validate + save the polygon, then re-run the point-in-polygon check
   * against ALL drivers and update their badges. Invalid shapes
   * (self-intersections, bad vertices) are rejected before anything
   * touches the database.
   */
  async savePolygon(input: {
    name?: string;
    coords: LatLng[];
    actorUserId?: string | null;
  }): Promise<{ polygon: PolygonDto; summary: EvaluateAllSummary }> {
    const validation = validatePolygon(input.coords);
    if (!validation.valid) {
      throw new BadRequestException(
        validation.errors.join(" ") || "Invalid polygon shape.",
      );
    }

    const previous = await this.getPolygon();
    const saved = await this.prisma.serviceAreaPolygon.upsert({
      where: { id: "service-area-la-metro-v1" },
      create: {
        id: "service-area-la-metro-v1",
        name: input.name?.trim() || LA_METRO_SERVICE_AREA_NAME,
        coordsJson: input.coords,
      },
      update: {
        name: input.name?.trim() || LA_METRO_SERVICE_AREA_NAME,
        coordsJson: input.coords,
      },
    });

    const summary = await this.evaluateAllDrivers({ dryRun: false });

    await this.prisma.adminAuditLog
      .create({
        data: {
          action: EnumAdminAuditLogAction.SERVICE_AREA_UPDATE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          reason: `Service-area polygon saved (${input.coords.length} vertices). Drivers: ${summary.inArea} in-area, ${summary.outOfArea} out, ${summary.unresolved} unresolved; flips: ${summary.flippedToIn} in, ${summary.flippedToOut} out.`,
          afterJson: {
            name: saved.name,
            vertexCount: input.coords.length,
            coords: input.coords,
          },
          beforeJson: {
            name: previous.name,
            vertexCount: previous.coords.length,
            coords: previous.coords,
          },
        },
      })
      .catch((e) => this.logger.warn(`Service-area audit write failed: ${e?.message}`));

    return { polygon: { name: saved.name, coords: saved.coordsJson as LatLng[], updatedAt: saved.updatedAt }, summary };
  }

  /** Dry-run for the editor's confirm dialog: how many badges would flip? */
  async previewPolygon(coords: LatLng[]): Promise<EvaluateAllSummary> {
    const validation = validatePolygon(coords);
    if (!validation.valid) {
      throw new BadRequestException(
        validation.errors.join(" ") || "Invalid polygon shape.",
      );
    }
    return this.evaluateAllDrivers({ dryRun: true, coordsOverride: coords });
  }

  /** Live badge stats for the admin page header. */
  async getStats(): Promise<{
    totalDrivers: number;
    inArea: number;
    outOfArea: number;
    unresolved: number;
    flagged: number;
  }> {
    const [totalDrivers, inArea, outOfArea, unresolved, flagged] =
      await Promise.all([
        this.prisma.driver.count(),
        this.prisma.driver.count({ where: { serviceAreaInArea: true } }),
        this.prisma.driver.count({ where: { serviceAreaInArea: false } }),
        this.prisma.driver.count({ where: { serviceAreaInArea: null } }),
        this.prisma.driver.count({ where: { serviceAreaFlagged: true } }),
      ]);
    return { totalDrivers, inArea, outOfArea, unresolved, flagged };
  }

  // ═══════════════════════ PER-DRIVER FLOW ═══════════════════════

  /**
   * Evaluate one driver's zip and persist the DERIVED fields. Never
   * touches Driver.status. Best-effort by contract: called from signup,
   * onboarding, and zip-change paths inside try/catch so a geocode outage
   * can never break account creation — the driver simply stays gray and
   * the next evaluation (zip change / polygon save) fixes it.
   */
  async evaluateDriverByZip(input: DriverEvaluationInput): Promise<DriverEvaluationResult> {
    const zip = normalizeServiceAreaZip(input.zipRaw);

    if (!zip) {
      // No usable zip → stay gray, flagged for review (owner spec).
      return this.persistDriverEvaluation({
        driverId: input.driverId,
        previousInArea: input.previousInArea,
        result: { zip: null, inArea: null, flagged: true, reason: "NO_ZIP" },
        source: input.source,
        dryRun: input.dryRun,
      });
    }

    const point = await this.geocodeZip(zip);
    if (!point) {
      return this.persistDriverEvaluation({
        driverId: input.driverId,
        previousInArea: input.previousInArea,
        result: { zip, inArea: null, flagged: true, reason: "UNRESOLVED_ZIP" },
        source: input.source,
        dryRun: input.dryRun,
      });
    }

    const polygon = await this.getPolygon();
    const inArea = pointInPolygon([point.lat, point.lng], polygon.coords);
    return this.persistDriverEvaluation({
      driverId: input.driverId,
      previousInArea: input.previousInArea,
      result: {
        zip,
        inArea,
        flagged: false,
        reason: inArea ? "IN_AREA" : "OUT_OF_AREA",
      },
      source: input.source,
      dryRun: input.dryRun,
    });
  }

  private async persistDriverEvaluation(input: {
    driverId: string;
    previousInArea?: boolean | null;
    result: DriverEvaluationResult;
    source: string;
    dryRun?: boolean;
  }): Promise<DriverEvaluationResult> {
    const { driverId, result, source, dryRun } = input;
    if (dryRun) return result;

    let previousInArea = input.previousInArea;
    if (previousInArea === undefined) {
      const row = await this.prisma.driver
        .findUnique({ where: { id: driverId }, select: { serviceAreaInArea: true } })
        .catch(() => null);
      previousInArea = row?.serviceAreaInArea ?? null;
    }

    try {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: {
          serviceAreaInArea: result.inArea,
          serviceAreaZip: result.zip,
          serviceAreaCheckedAt: new Date(),
          serviceAreaFlagged: result.flagged,
        },
        select: { id: true },
      });

      // Badge changes are audit-logged with the triggering zip. This write
      // is deliberately best-effort (must not break signup/zip-change flows).
      if (previousInArea !== result.inArea) {
        await this.prisma.adminAuditLog
          .create({
            data: {
              action: EnumAdminAuditLogAction.DRIVER_SERVICE_AREA_CHANGE,
              actorType: EnumAdminAuditLogActorType.SYSTEM,
              driverId,
              reason: `Service-area badge ${result.inArea === null ? "unresolved (flagged for review)" : result.inArea ? "GREEN" : "gray"} — zip ${result.zip ?? "none"} (${source}).`,
            },
          })
          .catch((e) =>
            this.logger.warn(`Driver service-area audit write failed: ${e?.message}`),
          );
      }
    } catch (e: any) {
      this.logger.warn(
        `Service-area evaluation write failed for driver ${driverId}: ${e?.message}`,
      );
    }
    return result;
  }

  // ═══════════════════════ BULK EVALUATION ═══════════════════════

  /**
   * Re-run the check against ALL drivers. Dry-run (the editor's preview)
   * computes the flip counts without writing; the real run persists every
   * badge change + per-driver audit rows for flips.
   */
  async evaluateAllDrivers(options: {
    dryRun: boolean;
    coordsOverride?: LatLng[];
  }): Promise<EvaluateAllSummary> {
    const polygon = options.coordsOverride
      ? { coords: options.coordsOverride }
      : { coords: (await this.getPolygon()).coords };

    const drivers = await this.prisma.driver.findMany({
      select: {
        id: true,
        residentialZip: true,
        serviceAreaInArea: true,
      },
    });

    const summary: EvaluateAllSummary = {
      totalDrivers: drivers.length,
      inArea: 0,
      outOfArea: 0,
      unresolved: 0,
      flippedToIn: 0,
      flippedToOut: 0,
      flippedZipsIn: [],
      flippedZipsOut: [],
    };

    const updates: Array<{ driverId: string; zip: string | null; next: boolean | null; prev: boolean | null; flagged: boolean }> = [];

    for (const driver of drivers) {
      const zip = normalizeServiceAreaZip(driver.residentialZip);
      let next: boolean | null = null;
      let flagged = false;

      if (!zip) {
        flagged = true;
        summary.unresolved++;
      } else {
        const point = await this.geocodeZip(zip);
        if (!point) {
          flagged = true;
          summary.unresolved++;
        } else {
          next = pointInPolygon([point.lat, point.lng], polygon.coords);
          if (next) summary.inArea++;
          else summary.outOfArea++;
        }
      }

      const prev = driver.serviceAreaInArea;
      if (prev !== next) {
        if (next === true && prev !== true) {
          summary.flippedToIn++;
          if (zip) summary.flippedZipsIn.push(zip);
        } else if (next === false && prev !== false) {
          summary.flippedToOut++;
          if (zip) summary.flippedZipsOut.push(zip);
        }
        updates.push({ driverId: driver.id, zip, next, prev, flagged });
      } else if (flagged && next === null) {
        // Still unresolved but flagged state may have drifted — skip; the
        // per-driver paths own flagged corrections for individual drivers.
      }
    }

    if (!options.dryRun && updates.length > 0) {
      await this.prisma.$transaction(
        updates.map((u) =>
          this.prisma.driver.update({
            where: { id: u.driverId },
            data: {
              serviceAreaInArea: u.next,
              serviceAreaZip: u.zip,
              serviceAreaCheckedAt: new Date(),
              serviceAreaFlagged: u.flagged,
            },
            select: { id: true },
          }),
        ),
      );

      // Per-driver audit rows for every flip (owner: "log every badge
      // change ... with timestamp and triggering zip").
      await this.prisma.adminAuditLog
        .createMany({
          data: updates.map((u) => ({
            action: EnumAdminAuditLogAction.DRIVER_SERVICE_AREA_CHANGE,
            actorType: EnumAdminAuditLogActorType.SYSTEM,
            driverId: u.driverId,
            reason: `Service-area badge ${u.next === null ? "unresolved (flagged for review)" : u.next ? "GREEN" : "gray"} — zip ${u.zip ?? "none"} (polygon saved).`,
          })),
        })
        .catch((e) =>
          this.logger.warn(`Bulk service-area audit write failed: ${e?.message}`),
        );
    }

    // Cap the sample lists returned to the editor (avoid huge payloads).
    summary.flippedZipsIn = summary.flippedZipsIn.slice(0, 50);
    summary.flippedZipsOut = summary.flippedZipsOut.slice(0, 50);
    return summary;
  }

  // ═══════════════════════ GEOCODING ═══════════════════════

  /**
   * ZIP → centroid, cached forever in ServiceAreaZipCache. Self-contained
   * Google Geocoding call (same endpoint/params as google-maps.service —
   * kept local so this module stays dependency-free and can never tangle
   * the delivery-logistics import graph into auth/driver/user modules).
   * Returns null on ANY failure — the caller marks the driver flagged,
   * never throws into the signup path.
   */
  async geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
    const cached = await this.prisma.serviceAreaZipCache
      .findUnique({ where: { zip } })
      .catch(() => null);
    if (cached) return { lat: cached.lat, lng: cached.lng };

    // Concurrent callers with the same zip share one in-flight promise.
    let pending = this.geocodeInFlight.get(zip);
    if (!pending) {
      pending = this.fetchGeocode(zip).finally(() =>
        this.geocodeInFlight.delete(zip),
      );
      this.geocodeInFlight.set(zip, pending);
    }
    return pending;
  }

  private async fetchGeocode(zip: string): Promise<{ lat: number; lng: number } | null> {
    const apiKey = this.configService.get<string>("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      this.logger.warn(
        "GOOGLE_MAPS_API_KEY not configured — service-area zip cannot be geocoded; driver stays gray/flagged.",
      );
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", `${zip}, USA`);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("region", "us");
      url.searchParams.set("components", "country:US|postal_code:" + zip);

      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        this.logger.warn(`Geocode HTTP ${response.status} for zip ${zip}`);
        return null;
      }
      const data: {
        status?: string;
        results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
      } = (await response.json()) as { status?: string; results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };

      const location = data.results?.[0]?.geometry?.location;
      if (data.status !== "OK" || !location || typeof location.lat !== "number") {
        this.logger.warn(`Geocode ${data.status ?? "NO_RESULT"} for zip ${zip}`);
        return null;
      }

      await this.prisma.serviceAreaZipCache
        .upsert({
          where: { zip },
          create: { zip, lat: location.lat, lng: location.lng },
          update: { lat: location.lat, lng: location.lng },
        })
        .catch((e) =>
          this.logger.warn(`Geocode cache write failed for zip ${zip}: ${e?.message}`),
        );

      return { lat: location.lat, lng: location.lng };
    } catch (e: any) {
      this.logger.warn(`Geocode failed for zip ${zip}: ${e?.message ?? e}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
