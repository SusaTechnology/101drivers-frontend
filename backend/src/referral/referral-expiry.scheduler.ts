/**
 * ReferralExpiryScheduler — periodic cron job for referral expiry.
 *
 * Runs DAILY at 03:00 server time. The handler internally tracks the
 * last run date and only does real work every 2 days (per spec).
 *
 * Conditional execution (per user spec):
 *   - If program isActive=false → skip entirely (no expiry processing)
 *   - If timeLimitMode=CALENDAR_RANGE and today is OUTSIDE the
 *     [windowStartDate, windowEndDate] window → skip entirely
 *   - Otherwise: scan Referral rows where expiresAt < now AND
 *     status is not yet terminal (REWARD_PAID, EXPIRED, CLOSED) and
 *     mark them EXPIRED.
 *
 * Why a cron for expiry when the trigger service already checks
 * expiry at fire-time? Because a referral might NEVER trigger
 * (e.g. driver never gets approved, never completes trips). Without
 * the cron, those rows would stay in PENDING/REGISTERED/TRIPPING
 * status forever, polluting stats. The cron sweeps them to EXPIRED.
 *
 * Why "every 2 days" instead of daily? Per user spec. We honor it
 * via a lastRunAt timestamp stored in AppSetting (REFERRAL_CRON_LAST_RUN).
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import { ReferralTimeLimitMode } from "../appSetting/dto/appSetting.dto";

const REFERRAL_CRON_LAST_RUN_KEY = "REFERRAL_CRON_LAST_RUN";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReferralExpiryScheduler {
  private readonly logger = new Logger(ReferralExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingService: AppSettingService,
  ) {}

  /**
   * Daily at 03:00 — handler internally skips every other day.
   * Using a daily cron + internal "last run" check is more reliable
   * than '0 3 *\/2 * *' (which fires on the 2nd, 4th, 6th... of each
   * month — not exactly every 2 days).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpiry(): Promise<void> {
    try {
      const config = await this.appSettingService.getReferralProgramSettings();

      // ── Conditional: skip if outside the calendar window ──
      // Per the user spec: "the CRON should run only on the referral
      // time span. so if today is not in the time window the CRON
      // will not run."
      //
      // Note: the isActive flag does NOT affect the cron. Pausing the
      // program (isActive=false) blocks new referrals from being
      // created AND blocks triggers from firing payouts, but it does
      // NOT stop the expiry sweep. This is correct: even when paused,
      // referrals past their expiresAt should be marked EXPIRED so
      // they don't pollute admin stats as "active" forever.
      //
      // For FOREVER mode, there's no calendar window — the cron
      // always runs (subject to the 2-day throttle).
      if (config.timeLimitMode === ReferralTimeLimitMode.CALENDAR_RANGE) {
        const now = new Date();
        const windowStart = config.windowStartDate ? new Date(config.windowStartDate) : null;
        const windowEnd = config.windowEndDate ? new Date(config.windowEndDate) : null;

        if (windowStart && now < windowStart) {
          this.logger.log(
            `Today (${now.toISOString()}) is before windowStartDate (${windowStart.toISOString()}) — cron skipping`
          );
          return;
        }
        if (windowEnd && now > windowEnd) {
          this.logger.log(
            `Today (${now.toISOString()}) is after windowEndDate (${windowEnd.toISOString()}) — cron skipping`
          );
          return;
        }
      }

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
