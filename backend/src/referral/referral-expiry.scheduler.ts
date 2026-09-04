/**
 * ReferralExpiryScheduler — periodic cron job for referral expiry.
 *
 * Runs DAILY at 03:00 server time. The handler internally tracks the
 * last run date and only does real work every 2 days (per spec).
 *
 * V3 behavior — the sweep is UNCONDITIONAL:
 *   - No calendar-window gating (removed): each Referral row carries its
 *     own `expiresAt` (referred driver's signup + referralWindowDays), so
 *     rows past their deadline are marked EXPIRED whenever the cron runs.
 *   - Pausing the program (isActive=false) blocks NEW referrals and
 *     payouts, but does NOT stop the expiry sweep — expired referrals
 *     can never pay out (the trigger service enforces the same rule at
 *     fire-time as a defensive backstop).
 *   - Why a cron at all? A referral might never trigger (e.g. driver
 *     never completes 5 deliveries). Without the cron those rows would
 *     stay REGISTERED/TRIPPING forever, polluting stats. The cron sweeps
 *     them to EXPIRED ("30-day window closed before 5 deliveries →
 *     expires unpaid — no partial payout").
 *   - Why "every 2 days"? Per user spec. Honored via a lastRunAt
 *     timestamp stored in AppSetting (REFERRAL_CRON_LAST_RUN). Payout
 *     correctness doesn't depend on the throttle — the trigger service
 *     checks expiry at fire-time.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

const REFERRAL_CRON_LAST_RUN_KEY = "REFERRAL_CRON_LAST_RUN";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReferralExpiryScheduler {
  private readonly logger = new Logger(ReferralExpiryScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Daily at 03:00 — handler internally skips every other day.
   * Using a daily cron + internal "last run" check is more reliable
   * than '0 3 *\/2 * *' (which fires on the 2nd, 4th, 6th... of each
   * month — not exactly every 2 days).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpiry(): Promise<void> {
    try {
      // ── V3: ALWAYS sweep — no calendar-window gate ──
      // The old rule ("run only inside the program's calendar window") is
      // GONE: the V3 per-referee 30-day window lives on each Referral row
      // (`expiresAt` = referred driver's signup + referralWindowDays), so
      // referrals must be swept to EXPIRED regardless of any program-level
      // calendar config. Note the isActive flag does NOT affect the sweep:
      // even when the program is paused, referrals past their expiresAt
      // must be marked EXPIRED — they can never pay out (the trigger
      // service's fire-time expiry check enforces the same rule).

      // ── Throttle: only run every 2 days ──
      const lastRunIso = await this.getLastRun();
      const lastRun = lastRunIso ? new Date(lastRunIso) : null;
      const now = new Date();
      if (lastRun && now.getTime() - lastRun.getTime() < TWO_DAYS_MS) {
        this.logger.log(
          `Last run was ${lastRun.toISOString()} — less than 2 days ago, skipping`
        );
        return;
      }

      // ── Do the actual expiry sweep ──
      // Marks referrals past their expiresAt as EXPIRED (unless they're
      // already in a terminal status). The trigger service ALSO checks
      // expiresAt at fire-time as a defensive measure, so even if the
      // cron is delayed, payouts can't slip through past expiry.
      const result = await this.prisma.referral.updateMany({
        where: {
          expiresAt: { lt: now },
          status: { notIn: ["REWARD_PAID", "EXPIRED", "CLOSED"] },
        },
        data: { status: "EXPIRED" },
      });

      this.logger.log(
        `Referral expiry sweep: marked ${result.count} referral(s) as EXPIRED`
      );

      // ── Update lastRun ──
      await this.setLastRun(now.toISOString());
    } catch (err) {
      this.logger.error(
        `Referral expiry cron failed: ${(err as Error).message}`,
        (err as Error).stack
      );
      // Don't rethrow — cron errors should not crash the process
    }
  }

  private async getLastRun(): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: REFERRAL_CRON_LAST_RUN_KEY },
      select: { value: true },
    });
    if (!row?.value || typeof row.value !== "object") return null;
    const v = row.value as { lastRunAt?: string };
    return typeof v.lastRunAt === "string" ? v.lastRunAt : null;
  }

  private async setLastRun(lastRunAt: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: REFERRAL_CRON_LAST_RUN_KEY },
      create: { key: REFERRAL_CRON_LAST_RUN_KEY, value: { lastRunAt } as any },
      update: { value: { lastRunAt } as any },
    });
  }
}
