/**
 * Unit tests for WeeklyPayoutScheduler.
 *
 * The cron method is invoked directly (the cron expression itself isn't
 * under test): verifies the kill switch, the engine hand-off, error
 * resilience, and the SETTINGS-DRIVEN registration (PAYOUT_SETTINGS ->
 * SchedulerRegistry, with a safe fallback if the configured expression
 * is invalid).
 */
import { WeeklyPayoutScheduler } from "./weekly-payout.scheduler";
import { defaultPayoutSettings } from "../appSetting/payout-settings";

jest.mock("cron", () => ({
  CronJob: jest.fn().mockImplementation(() => ({ start: jest.fn() })),
}));

import { CronJob } from "cron";
const CronJobMock = CronJob as unknown as jest.Mock;

const makeSchedulerRegistry = () => ({
  doesExist: jest.fn().mockReturnValue(false),
  addCronJob: jest.fn(),
  deleteCronJob: jest.fn(),
});

describe("WeeklyPayoutScheduler", () => {
  const originalDisabled = process.env.PAYOUT_WEEKLY_CRON_DISABLED;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalDisabled === undefined) {
      delete process.env.PAYOUT_WEEKLY_CRON_DISABLED;
    } else {
      process.env.PAYOUT_WEEKLY_CRON_DISABLED = originalDisabled;
    }
  });

  it("calls processWeeklyAutoPayouts and logs the result", async () => {
    const engine = { processWeeklyAutoPayouts: jest.fn().mockResolvedValue({ processed: 3, skipped: 1 }) };
    const scheduler = new WeeklyPayoutScheduler(engine as any);

    await scheduler.handleWeeklyAutoPayouts();

    expect(engine.processWeeklyAutoPayouts).toHaveBeenCalledTimes(1);
  });

  it("kill switch (PAYOUT_WEEKLY_CRON_DISABLED=true) skips the engine entirely", async () => {
    process.env.PAYOUT_WEEKLY_CRON_DISABLED = "true";
    const engine = { processWeeklyAutoPayouts: jest.fn() };
    const scheduler = new WeeklyPayoutScheduler(engine as any);

    await scheduler.handleWeeklyAutoPayouts();

    expect(engine.processWeeklyAutoPayouts).not.toHaveBeenCalled();
  });

  it("missing engine (undefined) is a safe no-op", async () => {
    const scheduler = new WeeklyPayoutScheduler(undefined);
    await expect(scheduler.handleWeeklyAutoPayouts()).resolves.toBeUndefined();
  });

  it("engine failure never throws out of the cron handler", async () => {
    const engine = { processWeeklyAutoPayouts: jest.fn().mockRejectedValue(new Error("stripe 500")) };
    const scheduler = new WeeklyPayoutScheduler(engine as any);
    jest.spyOn(scheduler["logger"], "error").mockImplementation(() => undefined);

    await expect(scheduler.handleWeeklyAutoPayouts()).resolves.toBeUndefined();
  });

  // ── settings-driven cron registration ─────────────────────────────

  it("syncCronFromSettings registers the cron from PAYOUT_SETTINGS (expression + timezone)", async () => {
    const prisma = {
      appSetting: {
        findUnique: jest.fn().mockResolvedValue({
          key: "PAYOUT_SETTINGS",
          value: { weeklyCron: "30 7 * * 1", weeklyTimezone: "America/New_York" },
        }),
      },
    };
    const registry = makeSchedulerRegistry();
    const scheduler = new WeeklyPayoutScheduler(undefined, prisma as any, registry as any);

    await scheduler.syncCronFromSettings();

    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
    expect(CronJobMock).toHaveBeenCalledWith(
      "30 7 * * 1",
      expect.any(Function),
      null,
      false,
      "America/New_York",
    );
  });

  it("syncCronFromSettings falls back to the default schedule when no setting row exists", async () => {
    const prisma = { appSetting: { findUnique: jest.fn().mockResolvedValue(null) } };
    const registry = makeSchedulerRegistry();
    const scheduler = new WeeklyPayoutScheduler(undefined, prisma as any, registry as any);

    await scheduler.syncCronFromSettings();

    expect(CronJobMock).toHaveBeenCalledWith(
      defaultPayoutSettings.weeklyCron,
      expect.any(Function),
      null,
      false,
      defaultPayoutSettings.weeklyTimezone,
    );
  });

  it("syncCronFromSettings survives a prisma failure by registering the defaults", async () => {
    const prisma = { appSetting: { findUnique: jest.fn().mockRejectedValue(new Error("db down")) } };
    const registry = makeSchedulerRegistry();
    const scheduler = new WeeklyPayoutScheduler(undefined, prisma as any, registry as any);
    jest.spyOn(scheduler["logger"], "warn").mockImplementation(() => undefined);

    await expect(scheduler.syncCronFromSettings()).resolves.toBeUndefined();

    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
    expect(CronJobMock).toHaveBeenCalledWith(
      defaultPayoutSettings.weeklyCron,
      expect.any(Function),
      null,
      false,
      defaultPayoutSettings.weeklyTimezone,
    );
  });

  it("re-syncing replaces the existing cron job (idempotent registration)", async () => {
    const prisma = { appSetting: { findUnique: jest.fn().mockResolvedValue(null) } };
    const registry = makeSchedulerRegistry();
    registry.doesExist.mockReturnValue(true);
    const scheduler = new WeeklyPayoutScheduler(undefined, prisma as any, registry as any);

    await scheduler.syncCronFromSettings();

    expect(registry.deleteCronJob).toHaveBeenCalledWith("weekly-driver-payouts");
    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
  });

  it("a settings expression the validator passes but cron rejects falls back to the default schedule", async () => {
    // "99 99 * * 1" is shape-valid (5 fields) but not a real schedule —
    // normalize can't know that, so the CronJob constructor is the last
    // line of defense and must never leave the drivers unswept.
    CronJobMock.mockImplementationOnce((expr: string) => {
      if (expr !== defaultPayoutSettings.weeklyCron) {
        throw new Error("Invalid cron expression");
      }
      return { start: jest.fn() };
    });
    const prisma = {
      appSetting: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ key: "PAYOUT_SETTINGS", value: { weeklyCron: "99 99 * * 1" } }),
      },
    };
    const registry = makeSchedulerRegistry();
    const scheduler = new WeeklyPayoutScheduler(undefined, prisma as any, registry as any);
    jest.spyOn(scheduler["logger"], "error").mockImplementation(() => undefined);

    await scheduler.syncCronFromSettings();

    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
    expect(CronJobMock).toHaveBeenLastCalledWith(
      defaultPayoutSettings.weeklyCron,
      expect.any(Function),
      null,
      false,
      defaultPayoutSettings.weeklyTimezone,
    );
  });
});
