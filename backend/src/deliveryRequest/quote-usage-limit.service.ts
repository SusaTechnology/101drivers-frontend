import { HttpException, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";

/**
 * Daily budget for quote calculations — the metered surface that
 * triggers billed Google Maps API calls (Geocoding + Routes API) on
 * every quote preview.
 *
 * WHAT IS COUNTED
 * Only the two quote-PREVIEW endpoints (public landing flow and the
 * authenticated dealer flow). Creating/saving a delivery from an
 * already-accepted quote is NOT counted — real orders are revenue and
 * must never be blocked by this damper.
 *
 * WHO IS COUNTED
 *   - Guests (no account): by client IP — the landing page is their
 *     only path in, and a grinding bot is exactly the threat here.
 *   - PRIVATE_CUSTOMER / other authenticated roles: by user id.
 *   - BUSINESS_CUSTOMER: by user id, higher budget.
 *   - ADMIN / DRIVER: ALWAYS exempt — their route metrics are
 *     operational (job feed, scheduling) and must never be blocked.
 *
 * THE SINGLE SOURCE FOR THE NUMBERS
 * The AppSetting DB row "QUOTE_USAGE_LIMITS", managed via
 * GET/PATCH /api/appSettings/quote-usage-limits (see
 * src/appSetting/quote-usage-limits.ts). It is read on every check, so
 * number changes apply on the NEXT request — no restart, no redeploy.
 *
 * FAILURE POSTURE: FAIL-OPEN
 * If anything inside this check throws (DB hiccup, unexpected shape),
 * the error is logged and the request PROCEEDS. This damper protects
 * the Google bill — it must never be able to take the quoting flow
 * down or block a real customer. The only exception ever raised is the
 * intentional 429 below.
 *
 * RACE POSTURE: COUNT-THEN-COMPARE
 * The counter is incremented atomically (UPDATE ... increment, or
 * INSERT on first use of the day) and the post-increment count decides
 * the verdict, so parallel requests each see their own attempt counted.
 * A few simultaneous requests past the limit under heavy race are
 * acceptable for a damper of this kind.
 */

const QUOTE_PREVIEW_SCOPE = "quote_preview";

@Injectable()
export class QuoteUsageLimitService {
  private readonly logger = new Logger(QuoteUsageLimitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSetting: AppSettingService,
  ) {}

  /**
   * Throws 429 QUOTE_DAILY_LIMIT_REACHED when the caller has used up
   * their daily quote budget. Callers with operational roles and any
   * request while limiting is disabled pass through untouched.
   */
  async assertQuotePreviewAllowed(input: {
    /** Authenticated user id, or null for guests. */
    userId: string | null;
    /** Roles of the authenticated user, or [] for guests. */
    roles: string[];
    /** Client IP (guests are budgeted per IP). */
    ip: string | null;
  }): Promise<void> {
    try {
      const limits = await this.appSetting.getQuoteUsageLimits();
      if (!limits.enabled) return;

      const roles = input.roles ?? [];
      // Operational roles: their quote/route usage is the business
      // itself (job feed, scheduling, ops tools) — never limited.
      if (roles.includes("ADMIN") || roles.includes("DRIVER")) return;

      let limit: number;
      let identity: string;
      if (input.userId) {
        identity = `user:${input.userId}`;
        if (roles.includes("BUSINESS_CUSTOMER")) {
          limit = limits.businessCustomerDailyLimit;
        } else {
          // PRIVATE_CUSTOMER — and any unrecognized authenticated role
          // gets the personal budget as the conservative middle ground.
          limit = limits.privateCustomerDailyLimit;
        }
      } else {
        identity = `ip:${input.ip || "unknown"}`;
        limit = limits.guestDailyLimit;
      }

      const used = await this.incrementAndGet(identity);

      if (used > limit) {
        throw new HttpException(
          {
            statusCode: 429,
            code: "QUOTE_DAILY_LIMIT_REACHED",
            message:
              `You've reached today's limit of ${limit} quote ` +
              `${limit === 1 ? "calculation" : "calculations"}. ` +
              `Your saved quotes are safe — please try again tomorrow.`,
            limit,
            used,
          },
          429,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Fail-open: a broken quota check must never break the product.
      this.logger.error(
        "Quote usage limit check failed — allowing request",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** UTC calendar day key — matches the day column semantics. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Atomically bump today's counter for this identity and return the
   * post-increment value. First use of the day creates the row; a
   * concurrent create (two first-requests in the same instant) falls
   * back to the atomic increment, which reconciles the count.
   */
  private async incrementAndGet(identity: string): Promise<number> {
    const day = this.today();
    const where = {
      scope_identity_day: {
        scope: QUOTE_PREVIEW_SCOPE,
        identity,
        day,
      },
    };

    try {
      const row = await this.prisma.dailyUsageCounter.update({
        where,
        data: { count: { increment: 1 } },
      });
      return row.count;
    } catch {
      // No row for today yet — create it at 1.
      try {
        const row = await this.prisma.dailyUsageCounter.create({
          data: {
            scope: QUOTE_PREVIEW_SCOPE,
            identity,
            day,
            count: 1,
          },
        });

        // Opportunistic cleanup: occasionally sweep rows from previous
        // days so the table stays small without a dedicated cron.
        if (Math.random() < 0.02) {
          this.prisma.dailyUsageCounter
            .deleteMany({ where: { day: { lt: day } } })
            .catch(() => {
              /* cleanup is best-effort */
            });
        }

        return row.count;
      } catch {
        // Lost a create race against a parallel first-request —
        // the row now exists, so the atomic increment is exact.
        const row = await this.prisma.dailyUsageCounter.update({
          where,
          data: { count: { increment: 1 } },
        });
        return row.count;
      }
    }
  }
}
