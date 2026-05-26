/**
 * Shared business timezone constants and formatting utilities.
 * All driver/dealer-facing pages must use these to ensure consistent
 * time display regardless of the user's browser timezone.
 */

export const BUSINESS_TZ = 'America/Los_Angeles'

// ── Core formatters ────────────────────────────────────────────────

export const formatTime = (iso?: string | null): string => {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: BUSINESS_TZ,
  })
}

export const formatDate = (iso?: string | null): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}

export const formatTimeRange = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return '--'
  return `${formatTime(start)} \u2013 ${formatTime(end)}`
}

export const formatDateTimeWindow = (startIso?: string | null, endIso?: string | null): string => {
  if (!startIso || !endIso) return ''
  const dayStr = new Date(startIso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
  const timeRange = formatTimeRange(startIso, endIso)
  return `${dayStr} \u2022 ${timeRange}`
}

export const formatFullDate = (iso?: string | null): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}

export const formatFullWeekdayDate = (iso?: string | null): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}

export const formatShortDayMonth = (iso?: string | null): string => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}
