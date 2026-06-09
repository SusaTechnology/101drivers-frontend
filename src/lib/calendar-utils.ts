/**
 * Calendar event utilities for delivery gigs.
 *
 * Platform-specific calendar integration:
 *  - iOS:  Opens .ics blob → Safari shows native "Add to Calendar" (Apple Calendar)
 *  - Android / Desktop: Opens Google Calendar deep link with pre-filled event
 *
 * The calling component is responsible for showing a confirmation dialog
 * before calling openCalendarEvent().
 */

// ── Types ───────────────────────────────────────────────────────────

export interface CalendarEventInput {
  deliveryId: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupWindowStart?: string | null
  pickupWindowEnd?: string | null
  dropoffWindowEnd?: string | null
  etaMinutes?: number | null
  payoutPreviewAmount?: number | null
  licensePlate?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleColor?: string
  isUrgent?: boolean
  serviceType?: string
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Detect iOS (iPhone, iPad, iPod).
 * iPad Pro reports as MacIntel, so also check maxTouchPoints.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Get a short address label (first line / street only) for titles.
 */
function shortAddress(address?: string): string {
  if (!address) return 'TBD'
  return address.split(',')[0].trim()
}

/**
 * Format a Date to ICS UTC datetime string: `YYYYMMDDTHHMMSSZ`
 */
function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Compute end date from available data.
 */
function computeEndDate(
  startDate: Date,
  event: CalendarEventInput,
): Date {
  if (event.dropoffWindowEnd) return new Date(event.dropoffWindowEnd)
  if (event.etaMinutes)
    return new Date(startDate.getTime() + event.etaMinutes * 60_000)
  return new Date(startDate.getTime() + 60 * 60_000) // 1 hour fallback
}

// ── ICS Generation (for iOS) ────────────────────────────────────────

/**
 * Build an RFC 5545 .ics file string.
 */
function buildICSFile(event: CalendarEventInput): string {
  const now = new Date()
  const startDate = event.pickupWindowStart
    ? new Date(event.pickupWindowStart)
    : null
  const endDate = startDate ? computeEndDate(startDate, event) : null

  if (!startDate || !endDate) return ''

  const uid = `delivery-${event.deliveryId}@101drivers.com`
  const title = `Car Delivery: ${shortAddress(event.pickupAddress)} \u2192 ${shortAddress(event.dropoffAddress)}`

  const descParts: string[] = []
  descParts.push(`Dropoff: ${event.dropoffAddress || 'TBD'}`)
  if (event.payoutPreviewAmount != null) {
    descParts.push(`Payout: $${event.payoutPreviewAmount.toFixed(2)}`)
  }
  if (event.isUrgent) descParts.push('Priority: URGENT')
  if (event.licensePlate) descParts.push(`Plate: ${event.licensePlate}`)
  if (event.vehicleMake || event.vehicleModel) {
    descParts.push(
      `Vehicle: ${[event.vehicleColor, event.vehicleMake, event.vehicleModel].filter(Boolean).join(' ')}`,
    )
  }
  descParts.push(`ID: ${event.deliveryId}`)
  const description = descParts.join('\\n')

  const escape = (str: string) =>
    str.replace(/[\\;,\n]/g, (ch) => {
      if (ch === '\\') return '\\\\'
      if (ch === ';') return '\\;'
      if (ch === ',') return '\\,'
      if (ch === '\n') return '\\n'
      return ch
    })

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//101Drivers//Delivery//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(startDate)}`,
    `DTEND:${toICSDate(endDate)}`,
    `SUMMARY:${escape(title)}`,
    `LOCATION:${escape(event.pickupAddress || '')}`,
    `DESCRIPTION:${escape(description)}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}

// ── Google Calendar URL (for Android / Desktop) ─────────────────────

/**
 * Build a Google Calendar deep-link URL with pre-filled event data.
 */
function buildGoogleCalendarURL(event: CalendarEventInput): string {
  const startDate = event.pickupWindowStart
    ? new Date(event.pickupWindowStart)
    : null
  if (!startDate) return ''

  const endDate = computeEndDate(startDate, event)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const detailsParts: string[] = []
  detailsParts.push(`Dropoff: ${event.dropoffAddress || 'TBD'}`)
  if (event.payoutPreviewAmount != null) {
    detailsParts.push(`Payout: $${event.payoutPreviewAmount.toFixed(2)}`)
  }
  if (event.isUrgent) detailsParts.push('Priority: URGENT')
  if (event.licensePlate) detailsParts.push(`Plate: ${event.licensePlate}`)
  if (event.vehicleMake || event.vehicleModel) {
    detailsParts.push(
      `Vehicle: ${[event.vehicleColor, event.vehicleMake, event.vehicleModel].filter(Boolean).join(' ')}`,
    )
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Car Delivery: ${shortAddress(event.pickupAddress)} \u2192 ${shortAddress(event.dropoffAddress)}`,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    location: event.pickupAddress || '',
    details: detailsParts.join('\n'),
  })

  return `https://www.google.com/calendar/render?${params.toString()}`
}

// ── Main Export ──────────────────────────────────────────────────────

/**
 * Open the delivery event in the appropriate calendar app.
 *
 * - iOS (iPhone/iPad):  Opens .ics blob URL → Safari triggers native
 *   "Add to Calendar" prompt (Apple Calendar).
 * - Android / Desktop:  Opens Google Calendar with pre-filled event
 *   in a new tab. User taps "Save" to add it.
 *
 * Throws if no pickup time is available.
 * The calling component should show a confirmation dialog before calling this.
 */
export function openCalendarEvent(event: CalendarEventInput): void {
  if (!event.pickupWindowStart) {
    throw new Error('No scheduled pickup time available for this delivery.')
  }

  if (isIOS()) {
    // iOS: Create .ics blob URL → Safari shows native "Add to Calendar"
    const icsContent = buildICSFile(event)
    if (!icsContent) return
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Revoke after 10 seconds to free memory
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } else {
    // Android / Desktop: Open Google Calendar deep link
    const gcalUrl = buildGoogleCalendarURL(event)
    if (gcalUrl) {
      window.open(gcalUrl, '_blank')
    }
  }
}

/**
 * Validate that a delivery has enough data for a calendar event.
 * Returns true if a pickup time is set.
 */
export function canAddToCalendar(event: CalendarEventInput): boolean {
  return Boolean(event.pickupWindowStart)
}
