/**
 * WeeklyPayoutScheduler — the weekly sweep is THE driver payout rail
 * (Lyft/DoorDash rhythm): drivers watch their eligible balance grow in
 * the wallet, and this cron transfers the whole balance to their Stripe
 * Connect account in one batch per week (PayoutBatch type=WEEKLY_AUTO).
 *
 * The schedule is SETTING-DRIVEN, not hardcoded: on boot the cron job is
 * registered from PAYOUT_SETTINGS (weeklyCron + weeklyTimezone; defaults
 * Monday 06:00 America/Los_Angeles). Admin edits apply INSTANTLY: the
 * settings save publishes an in-process change event and this scheduler
 * re-registers the cron — no restart, no waiting. A lightweight watchdog
 * still re-checks PAYOUT_SETTINGS every 5 minutes as a self-healing
 * safety net for writes that bypass the API (direct DB edits, Prisma
 * Studio) and re-registers if the job ever vanishes from the registry.
 * The other payout flags (minimum, autoTransferOnCompletion,
 * driverCashoutEnabled) are read LIVE by the engine on every use.
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
  onPayoutSettingsChanged,
} from "../appSetting/payout-settings";

const WEEKLY_PAYOUT_JOB_NAME = "weekly-driver-payouts";

/** How often the watchdog re-checks PAYOUT_SETTINGS for schedule changes. */
const SETTINGS_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class WeeklyPayoutScheduler {
  private readonly logger = new Logger(WeeklyPayoutScheduler.name);

  /** What the currently-registered cron was built from (watchdog baseline). */
  private lastAppliedCron: string | null = null;
  private lastAppliedTimezone: string | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  /** Unsubscribe from PAYOUT_SETTINGS change events (module destroy). */
  private unsubscribeSettingsChange: (() => void) | null = null;

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
      this.lastAppliedCron = settings.weeklyCron;
      this.lastAppliedTimezone = settings.weeklyTimezone;
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
      // Record the DEFAULT as applied: the watchdog compares against what
      // is actually running, so a still-invalid setting retries (and
      // self-heals) on the next check instead of thrashing immediately.
      this.lastAppliedCron = defaultPayoutSettings.weeklyCron;
      this.lastAppliedTimezone = defaultPayoutSettings.weeklyTimezone;
    }
  }

  /**
   * Watchdog tick — the SAFETY NET, not the primary apply path: admin
   * edits reach us instantly via onPayoutSettingsChanged (published by
   * AppSettingService.updatePayoutSettings). This tick catches what an
   * in-process event can never see: writes that bypass the API (direct
   * DB edits, Prisma Studio, a manual hotfix) and a job that vanished
   * from the registry (self-healing). A transient DB read failure keeps
   * the currently registered job untouched.
   */
  async checkCronSync(): Promise<void> {
    if (!this.prisma || !this.schedulerRegistry) return;

    let jobMissing = false;
    try {
      jobMissing = !this.schedulerRegistry.doesExist("cron", WEEKLY_PAYOUT_JOB_NAME);
    } catch {
      jobMissing = false;
    }

    let settings: ReturnType<typeof normalizePayoutSettings>;
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: PAYOUT_SETTINGS_KEY },
        select: { value: true },
      });
      settings = normalizePayoutSettings(row?.value);
    } catch {
      return; // transient DB issue — keep the currently registered job
    }

    const scheduleChanged =
      settings.weeklyCron !== this.lastAppliedCron ||
      settings.weeklyTimezone !== this.lastAppliedTimezone;

    if (jobMissing || scheduleChanged) {
      this.logger.log(
        `PAYOUT_SETTINGS change detected (cron "${this.lastAppliedCron}" -> "${settings.weeklyCron}", tz "${this.lastAppliedTimezone}" -> "${settings.weeklyTimezone}"${jobMissing ? ", job missing" : ""}) — re-registering weekly payouts cron`,
      );
      await this.syncCronFromSettings();
    }
  }

  /**
   * Periodically re-check PAYOUT_SETTINGS as a self-healing safety net
   * for out-of-band writes (the change event is the instant path).
   * The timer never keeps the process alive.
   */
  private startSettingsWatchdog(): void {
    if (this.watchdogTimer || !this.prisma || !this.schedulerRegistry) return;
    this.watchdogTimer = setInterval(() => {
      void this.checkCronSync();
    }, SETTINGS_WATCHDOG_INTERVAL_MS);
    (this.watchdogTimer as any)?.unref?.();
  }

  onModuleInit(): void {
    void this.syncCronFromSettings();
    // PRIMARY apply path: re-register the moment an admin saves
    // PAYOUT_SETTINGS via the API. The handler re-reads the persisted row
    // (instead of trusting the event payload) so it always applies exactly
    // what is in the DB, and re-registration stays idempotent.
    this.unsubscribeSettingsChange = onPayoutSettingsChanged(() =>
      this.syncCronFromSettings(),
    );
    this.startSettingsWatchdog();
  }

  onModuleDestroy(): void {
    if (this.unsubscribeSettingsChange) {
      this.unsubscribeSettingsChange();
      this.unsubscribeSettingsChange = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
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
      const result = await this.payoutEngine.processWeeklyAutoPayouts("CRON");
      this.logger.log(
        `Weekly auto-payouts: ${result?.processed ?? 0} processed, ${result?.skipped ?? 0} skipped${result?.runId ? ` (run ${result.runId})` : ""}`,
      );
    } catch (err: any) {
      this.logger.error(`Weekly auto-payouts failed: ${err?.message}`, err?.stack);
    }
  }
}
