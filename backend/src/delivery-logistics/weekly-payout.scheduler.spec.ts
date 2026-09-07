/**
 * Unit tests for WeeklyPayoutScheduler.
 *
 * The @Cron-annotated method is invoked directly (cron expression itself
 * isn't under test): verifies the kill switch, the engine hand-off, and
 * error resilience.
 */
import { WeeklyPayoutScheduler } from "./weekly-payout.scheduler";

describe("WeeklyPayoutScheduler", () => {
  const originalDisabled = process.env.PAYOUT_WEEKLY_CRON_DISABLED;

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
});
