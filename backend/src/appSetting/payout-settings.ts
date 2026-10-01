/**
 * PAYOUT_SETTINGS — the single source of truth for driver payout behavior.
 *
 * Standalone module (no Nest DI) so it can be imported by EVERY consumer:
 *   • appSetting.service.ts  — admin read/write via GET/PATCH /appSettings/payout
 *   • paymentPayout.engine.ts — live reads at sweep/transfer/withdrawal time
 *     (via PrismaService.appSetting directly — no module-wiring cycles)
 *   • weekly-payout.scheduler.ts — cron expression + timezone registration
 *
 * Design contract (product decision, go-live):
 *   • Weekly is THE payout rail. Drivers see their eligible balance grow in
 *     the wallet; the weekly cron sweeps it to their Stripe Connect account.
 *   • "Pay and forget" per-delivery auto-transfer is OFF by default — the
 *     code path stays but is gated behind `autoTransferOnCompletion`.
 *   • Driver-initiated cash-out (free / instant) is OFF by default — gated
 *     behind `driverCashoutEnabled`.
 *   • The weekly sweep pays EVERYTHING at or above the minimum (Stripe's
 *     transfer minimum is $0.50 — a lower value would make transfers fail).
 *
 * NOTE: the cron SCHEDULE (expression + timezone) is registered at boot.
 * Changing it via the admin setting takes effect after the next API
 * restart (pm2 restart 101drivers-api). The other flags (minimum,
 * autoTransferOnCompletion, driverCashoutEnabled) are read LIVE on every
 * use — no restart needed.
 */

export const PAYOUT_SETTINGS_KEY = "PAYOUT_SETTINGS";

export interface PayoutSettings {
  /** Cron expression for the weekly sweep. Default: Monday 06:00. */
  weeklyCron: string;
  /** IANA timezone the cron runs in. Default: America/Los_Angeles. */
  weeklyTimezone: string;
  /**
   * Minimum ELIGIBLE balance (+ pending adjustments) for the weekly sweep
   * to include a driver, in dollars. Floor-clamped to 0.50 — Stripe
   * rejects transfers below $0.50.
   */
  minimumWeeklyPayoutDollars: number;
  /**
   * "Pay and forget" rail: fire a Stripe transfer the moment a delivery
   * completes. Default false — payouts accumulate for the weekly sweep.
   */
  autoTransferOnCompletion: boolean;
  /**
   * Driver-initiated manual cash-out rails in the wallet (free withdrawal
   * + instant payout). Default false — the weekly sweep is the only way
   * money leaves.
   */
  driverCashoutEnabled: boolean;
}

export const defaultPayoutSettings: PayoutSettings = {
  weeklyCron: "0 6 * * 1", // Monday 06:00
  weeklyTimezone: "America/Los_Angeles",
  minimumWeeklyPayoutDollars: 0.5, // Stripe transfer minimum
  autoTransferOnCompletion: false,
  driverCashoutEnabled: false,
};

/** Stripe rejects transfers below $0.50 — never allow a lower minimum. */
export const MIN_WEEKLY_PAYOUT_FLOOR_DOLLARS = 0.5;

const CRON_FIELD_RE = /^[\d*,/\-A-Za-z]+$/;

function isValidCron(expr: unknown): expr is string {
  if (typeof expr !== "string") return false;
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((f) => f.length > 0 && CRON_FIELD_RE.test(f));
}

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge a raw AppSetting JSON value over the defaults with per-field
 * sanitization. Any invalid/hand-edited field silently falls back to its
 * default — a broken settings row can never stop driver payouts.
 */
export function normalizePayoutSettings(raw: unknown): PayoutSettings {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<Record<keyof PayoutSettings, unknown>>)
      : {};

  const merged: PayoutSettings = { ...defaultPayoutSettings };

  if (isValidCron(value.weeklyCron)) {
    merged.weeklyCron = value.weeklyCron.trim();
  }

  if (isValidTimezone(value.weeklyTimezone)) {
    merged.weeklyTimezone = value.weeklyTimezone;
  }

  if (
    typeof value.minimumWeeklyPayoutDollars === "number" &&
    Number.isFinite(value.minimumWeeklyPayoutDollars)
  ) {
    merged.minimumWeeklyPayoutDollars = Math.max(
      MIN_WEEKLY_PAYOUT_FLOOR_DOLLARS,
      value.minimumWeeklyPayoutDollars,
    );
  }

  if (typeof value.autoTransferOnCompletion === "boolean") {
    merged.autoTransferOnCompletion = value.autoTransferOnCompletion;
  }

  if (typeof value.driverCashoutEnabled === "boolean") {
    merged.driverCashoutEnabled = value.driverCashoutEnabled;
  }

  return merged;
}

const CRON_DAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/**
 * Human-readable cadence for the driver wallet, e.g.
 * "Mondays at 6:00 AM (America/Los_Angeles)". Falls back to the raw cron
 * expression for non-standard shapes — the wallet renders whatever this
 * returns.
 */
export function describeWeeklyCron(settings: PayoutSettings): string {
  const fields = settings.weeklyCron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Weekly (${settings.weeklyCron}, ${settings.weeklyTimezone})`;
  }
  const [, hourStr, , dowStr] = fields;
  const hour = Number(hourStr);
  const dow = Number(dowStr);
  const dayName =
    Number.isInteger(dow) && dow >= 0 && dow <= 6
      ? CRON_DAY_NAMES[dow]
      : "Weekly";
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return `${dayName} (${settings.weeklyTimezone})`;
  }
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${dayName} at ${hour12}:${String(
    Number(fields[0]) || 0,
  ).padStart(2, "0")} ${ampm} (${settings.weeklyTimezone})`;
}
