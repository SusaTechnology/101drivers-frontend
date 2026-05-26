import { DateTime, Duration } from "luxon";

/**
 * Business timezone for 101Drivers operations.
 * All scheduling decisions (cutoff, same-day checks, after-hours, feed boundaries)
 * must use this timezone — NOT the server's system timezone.
 */
export const BUSINESS_TZ = "America/Los_Angeles";

/**
 * Current moment in business timezone.
 */
export function businessNow(): DateTime {
  return DateTime.now().setZone(BUSINESS_TZ);
}

/**
 * Convert any Date/string to a Luxon DateTime in the business timezone.
 */
export function toBusinessDateTime(value: Date | string): DateTime {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value).setZone(BUSINESS_TZ);
  }
  return DateTime.fromISO(value, { zone: BUSINESS_TZ });
}

/**
 * Start of today (midnight) in business timezone, as a JS Date.
 * Safe for Prisma queries: `updatedAt: { gte: businessStartOfDay() }`
 */
export function businessStartOfDay(): Date {
  return businessNow().startOf("day").toJSDate();
}

/**
 * End of today (23:59:59.999) in business timezone, as a JS Date.
 */
export function businessEndOfDay(): Date {
  return businessNow().endOf("day").toJSDate();
}

/**
 * Start of tomorrow in business timezone, as a JS Date.
 */
export function businessStartOfTomorrow(): Date {
  return businessNow().plus({ days: 1 }).startOf("day").toJSDate();
}

/**
 * Start of day after tomorrow in business timezone, as a JS Date.
 */
export function businessStartOfDayAfterTomorrow(): Date {
  return businessNow().plus({ days: 2 }).startOf("day").toJSDate();
}

/**
 * Start of this month (1st midnight) in business timezone, as a JS Date.
 */
export function businessStartOfMonth(): Date {
  return businessNow().startOf("month").toJSDate();
}

/**
 * End of this week (Sunday 23:59:59.999) in business timezone, as a JS Date.
 */
export function businessEndOfWeek(): Date {
  const now = businessNow();
  const weekday = now.weekday; // 1=Monday ... 7=Sunday
  const daysUntilSunday = weekday === 7 ? 0 : 7 - weekday;
  return now.plus({ days: daysUntilSunday }).endOf("day").toJSDate();
}

/**
 * Subtract a duration from the current business time, return as JS Date.
 */
export function businessMinus(duration: Duration | { days?: number; hours?: number; minutes?: number }): Date {
  return businessNow().minus(duration).toJSDate();
}

/**
 * Get the hour (0-23) of a Date in the business timezone.
 */
export function businessHourOf(value: Date | string): number {
  return toBusinessDateTime(value).hour;
}

/**
 * Check if two dates fall on the same calendar day in the business timezone.
 */
export function businessIsSameDay(
  a: Date | string,
  b: Date | string,
): boolean {
  return toBusinessDateTime(a).hasSame(toBusinessDateTime(b), "day");
}

/**
 * Check if the current business time has passed a given HH:MM cutoff.
 * Returns true if past cutoff, false if before or at cutoff.
 */
export function businessIsPastCutoff(hhmm: string): boolean {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return false;

  const now = businessNow();
  const cutoff = now.set({
    hour: parseInt(match[1], 10),
    minute: parseInt(match[2], 10),
    second: 0,
    millisecond: 0,
  });

  return now > cutoff;
}
