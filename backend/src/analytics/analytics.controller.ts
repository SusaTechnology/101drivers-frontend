import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

import { RateLimitService, assertIpBudget, RATE_LIMITS, clientIpFromRequest } from "../common/rate-limit/rate-limit.service";
import { PrismaService } from "../prisma/prisma.service";
import { DefaultAuthGuard } from "../auth/defaultAuth.guard";
import { Public } from "../decorators/public.decorator";

import {
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_INTERVALS,
  AnalyticsEventType,
  AnalyticsInterval,
  AnalyticsService,
} from "./analytics.service";

// ═══════════════════════════════════════════════════════════════════════
// Product analytics API (Task 72)
//
//   POST /analytics/events    — PUBLIC ingest, PAGE_VIEW only, IP-budgeted.
//                               SIGNUP/LOGIN/DELIVERY_CREATED are recorded
//                               server-side ONLY and are rejected here so a
//                               client can never forge business metrics.
//   GET  /analytics/overview  — ADMIN: totals + deltas + daily/monthly +
//                               cumulative in one payload.
//   GET  /analytics/timeseries— ADMIN: gap-free bucketed series.
//   GET  /analytics/records   — ADMIN: raw append-only ledger, paginated.
// ═══════════════════════════════════════════════════════════════════════

@UseGuards(DefaultAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly jwt: JwtService
  ) {}

  // ── Public ingest ────────────────────────────────────────────────────

  @Public()
  @Post("events")
  async ingest(@Body() body: any, @Req() request: Request): Promise<{ ok: true }> {
    // Client-claimable events are PAGE_VIEW only — everything else is
    // recorded by the server where the action actually happens.
    if (body?.type !== "PAGE_VIEW") {
      throw new BadRequestException("Only PAGE_VIEW events are accepted from clients");
    }

    // Flood budget: generous for honest SPA navigation, hostile to scripts.
    assertIpBudget(
      request,
      "analytics-ingest",
      this.rateLimit,
      RATE_LIMITS.ANALYTICS_INGEST_PER_IP
    );

    const user = await this.resolveOptionalUser(request);

    // recordSafe never throws — a ledger hiccup can never 500 the ping.
    await this.analytics.recordSafe({
      type: "PAGE_VIEW",
      userId: user?.id ?? null,
      role: this.normalizeRole(user?.roles),
      sessionId: body?.sessionId,
      path: body?.path,
      referrer: body?.referrer,
      userAgent: request.headers["user-agent"],
      ip: clientIpFromRequest(request),
    });

    return { ok: true };
  }

  // ── Admin queries ────────────────────────────────────────────────────

  @Get("overview")
  async overview(
    @Req() request: Request,
    @Query("from") from?: string,
    @Query("to") to?: string
  ): Promise<any> {
    this.assertAdmin(request);
    return this.analytics.overview({
      from: this.parseDate(from, "from") ?? undefined,
      to: this.parseDate(to, "to") ?? undefined,
    });
  }

  @Get("timeseries")
  async timeseries(
    @Req() request: Request,
    @Query("interval") interval?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("type") type?: string
  ): Promise<any> {
    this.assertAdmin(request);
    const resolvedTo = this.parseDate(to, "to") ?? new Date();
    const resolvedInterval = this.parseInterval(interval);
    const resolvedFrom =
      this.parseDate(from, "from") ??
      new Date(
        resolvedTo.getTime() -
          (resolvedInterval === "hour" ? 24 : 30) * 60 * 60 * 1000
      );

    return this.analytics.timeseries({
      interval: resolvedInterval,
      from: resolvedFrom,
      to: resolvedTo,
      type: this.parseEventType(type),
    });
  }

  @Get("records")
  async records(
    @Req() request: Request,
    @Query("type") type?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ): Promise<any> {
    this.assertAdmin(request);
    return this.analytics.records({
      type: this.parseEventType(type),
      from: this.parseDate(from, "from"),
      to: this.parseDate(to, "to"),
      page: page ? Number(page) : null,
      pageSize: pageSize ? Number(pageSize) : null,
    });
  }

  /**
   * Spam radar — driver-registration attempts blocked by the mobile-only
   * user-agent guard (BlockedSignup ledger: timestamp, IP, user agent,
   * attempted email, reason). ADMIN-only like every other query here.
   */
  @Get("blocked-signups")
  async blockedSignups(
    @Req() request: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ): Promise<any> {
    this.assertAdmin(request);
    return this.analytics.blockedSignups({
      from: this.parseDate(from, "from"),
      to: this.parseDate(to, "to"),
      page: page ? Number(page) : null,
      pageSize: pageSize ? Number(pageSize) : null,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  /** ADMIN-only gate (same contract as the hardened business controllers). */
  private assertAdmin(request: Request): void {
    const user: any = (request as any).user ?? null;
    const isAdmin = Array.isArray(user?.roles) && user.roles.includes("ADMIN");
    if (!isAdmin) {
      throw new ForbiddenException("Admin access required");
    }
  }

  /** DB stores a scalar role; JWTs may carry an array — accept both. */
  private normalizeRole(roles: unknown): string | null {
    if (Array.isArray(roles) && roles.length) return String(roles[0]);
    if (typeof roles === "string" && roles) return roles;
    return null;
  }

  /**
   * Optional identity enrichment for public pings: verify the Bearer
   * token when one is present; anything else (no token, expired,
   * garbage) is an anonymous visitor — NEVER a 401.
   */
  private async resolveOptionalUser(
    request: Request
  ): Promise<{ id: string; roles?: string[] } | null> {
    const header = request.headers["authorization"];
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return null;

    try {
      const payload: any = await this.jwt.verifyAsync(token);
      const userId: unknown = payload?.sub ?? payload?.id;
      if (!userId || typeof userId !== "string") return null;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, roles: true, isActive: true },
      });
      if (!user || user.isActive === false) return null;
      return user as unknown as { id: string; roles?: string[] };
    } catch {
      return null;
    }
  }

  private parseEventType(value: unknown): AnalyticsEventType | null {
    if (typeof value !== "string" || !value.trim()) return null;
    if (!(ANALYTICS_EVENT_TYPES as readonly string[]).includes(value)) {
      throw new BadRequestException(`Unknown analytics event type: ${value}`);
    }
    return value as AnalyticsEventType;
  }

  private parseInterval(value: unknown): AnalyticsInterval {
    const resolved = (typeof value === "string" && value.trim()) || "day";
    if (!(ANALYTICS_INTERVALS as readonly string[]).includes(resolved)) {
      throw new BadRequestException("interval must be hour, day or month");
    }
    return resolved as AnalyticsInterval;
  }

  private parseDate(value: unknown, name: string): Date | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${name} must be a valid ISO date`);
    }
    return date;
  }
}
