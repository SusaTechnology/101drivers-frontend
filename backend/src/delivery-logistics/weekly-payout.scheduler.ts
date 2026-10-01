/**
 * WeeklyPayoutScheduler — the weekly sweep is THE driver payout rail
 * (Lyft/DoorDash rhythm): drivers watch their eligible balance grow in
 * the wallet, and this cron transfers the whole balance to their Stripe
 * Connect account in one batch per week (PayoutBatch type=WEEKLY_AUTO).
 *
 * The schedule is SETTING-DRIVEN, not hardcoded: on boot the cron job is
 * registered from PAYOUT_SETTINGS (weeklyCron + weeklyTimezone; defaults
 * Monday 06:00 America/Los_Angeles). Changing the schedule in the admin
 * setting takes effect on the next API restart; the other payout flags
 * (minimum, autoTransferOnCompletion, driverCashoutEnabled) are read
 * LIVE by the engine on every use.
 *
 * Safety:
 *   - Drivers WITHOUT completed Connect onboarding are skipped (their
 *     batch reverts + their money stays in the balance until they finish
 *     "Set Up Payouts").
 *   - Deliveries with an open dispute under legal hold are excluded from
 *     the sweep (enforced inside processWeeklyAutoPayouts).
 *   - Kill switch: set PAYOUT_WEEKLY_CRON_DISABLED=true to turn the cron
 *     off without a deploy.
 *   - The admin can still trigger the same run manually via
 *     POST /driverPayouts/admin/process-weekly-payouts.
 */

import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";

import { PrismaService } from "../prisma/prisma.service";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";
import {
  PAYOUT_SETTINGS_KEY,
  defaultPayoutSettings,
  normalizePayoutSettings,
} from "../appSetting/payout-settings";

const WEEKLY_PAYOUT_JOB_NAME = "weekly-driver-payouts";

@Injectable()
export class WeeklyPayoutScheduler {
  private readonly logger = new Logger(WeeklyPayoutScheduler.name);

  constructor(
    @Optional() @Inject(PaymentPayoutEngine)
    private readonly payoutEngine?: PaymentPayoutEngine,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly schedulerRegistry?: SchedulerRegistry,
  ) {}

  /**
   * Register (or re-register) the weekly cron from PAYOUT_SETTINGS.
   * Called on module init; safe to call again to apply setting changes
   * without a restart (delete + re-add the job).
   */
  async syncCronFromSettings(): Promise<void> {
    if (!this.schedulerRegistry) {
      this.logger.warn(
        "Weekly payouts cron not registered — SchedulerRegistry unavailable",
      );
      return;
    }

    let settings = { ...defaultPayoutSettings };
    if (this.prisma) {
      try {
        const row = await this.prisma.appSetting.findUnique({
          where: { key: PAYOUT_SETTINGS_KEY },
          select: { value: true },
        });
        settings = normalizePayoutSettings(row?.value);
      } catch (err: any) {
        this.logger.warn(
          `PAYOUT_SETTINGS read failed — registering cron with defaults: ${err?.message}`,
        );
      }
    }

    // Replace an existing registration so re-syncs are idempotent.
    try {
      if (this.schedulerRegistry.doesExist("cron", WEEKLY_PAYOUT_JOB_NAME)) {
        this.schedulerRegistry.deleteCronJob(WEEKLY_PAYOUT_JOB_NAME);
      }
    } catch {
      // doesExist/delete failures are non-fatal — addCronJob below will
      // surface a real conflict.
    }

    try {
      const job = new CronJob(
        settings.weeklyCron,
        () => {
          void this.handleWeeklyAutoPayouts();
        },
        null,
        false,
        settings.weeklyTimezone,
      );
      this.schedulerRegistry.addCronJob(WEEKLY_PAYOUT_JOB_NAME, job);
      job.start();
      this.logger.log(
        `Weekly payouts cron registered: "${settings.weeklyCron}" (${settings.weeklyTimezone})`,
      );
    } catch (err: any) {
      // A bad expression that slipped through validation must not leave
      // drivers unswept forever — fall back to the default schedule.
      this.logger.error(
        `Invalid weeklyCron "${settings.weeklyCron}" — registering default "${defaultPayoutSettings.weeklyCron}": ${err?.message}`,
      );
      const fallback = new CronJob(
        defaultPayoutSettings.weeklyCron,
        () => {
          void this.handleWeeklyAutoPayouts();
        },
        null,
        false,
        defaultPayoutSettings.weeklyTimezone,
      );
      this.schedulerRegistry.addCronJob(WEEKLY_PAYOUT_JOB_NAME, fallback);
      fallback.start();
    }
  }

  onModuleInit(): void {
    void this.syncCronFromSettings();
  }

  /** The weekly sweep — engine hand-off. Env kill switch honored here. */
  async handleWeeklyAutoPayouts(): Promise<void> {
    if (process.env.PAYOUT_WEEKLY_CRON_DISABLED === "true") {
      this.logger.log("Weekly auto-payouts skipped — PAYOUT_WEEKLY_CRON_DISABLED=true");
      return;
    }
    if (!this.payoutEngine) {
      this.logger.warn("Weekly auto-payouts skipped — PaymentPayoutEngine unavailable");
      return;
    }

    try {
      const result = await this.payoutEngine.processWeeklyAutoPayouts();
      this.logger.log(
        `Weekly auto-payouts: ${result?.processed ?? 0} processed, ${result?.skipped ?? 0} skipped`,
      );
    } catch (err: any) {
      this.logger.error(`Weekly auto-payouts failed: ${err?.message}`, err?.stack);
    }
  }
}
