/**
 * Calendar event utilities for delivery gigs.
 *
 * Generates an RFC 5545 .ics file from delivery data and exports it
 * via the Web Share API (mobile) or a .ics file download (desktop).
 */

import { BUSINESS_TZ } from '@/lib/timezone'

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

// ── ICS Generation ───────────────────────────────────────────────────

/**
 * Format a Date to ICS UTC datetime string: `YYYYMMDDTHHMMSSZ`
 */
function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Get a short address label (first line / street only) for titles.
 */
function shortAddress(address?: string): string {
  if (!address) return 'TBD'
  return address.split(',')[0].trim()
}

/**
 * Build an RFC 5545 .ics file string.
 */
export function buildICSFile(event: CalendarEventInput): string {
  const now = new Date()

  // Determine event start: use pickupWindowStart
  const startDate = event.pickupWindowStart
    ? new Date(event.pickupWindowStart)
    : null

  // Determine event end: prefer dropoffWindowEnd, else start + eta, else start + 1h
  let endDate: Date | null = null
  if (event.dropoffWindowEnd) {
    endDate = new Date(event.dropoffWindowEnd)
  } else if (startDate && event.etaMinutes) {
    endDate = new Date(startDate.getTime() + event.etaMinutes * 60_000)
  } else if (startDate) {
    endDate = new Date(startDate.getTime() + 60 * 60_000) // 1 hour fallback
  }

  // If no start time, we can't create a valid calendar event
  if (!startDate || !endDate) {
    return ''
  }

  const uid = `delivery-${event.deliveryId}@101drivers.com`
  const title = `Car Delivery: ${shortAddress(event.pickupAddress)} → ${shortAddress(event.dropoffAddress)}`

  // Build description lines
  const descParts: string[] = []
  descParts.push(`Dropoff: ${event.dropoffAddress || 'TBD'}`)
  if (event.payoutPreviewAmount != null) {
    descParts.push(`Payout: $${event.payoutPreviewAmount.toFixed(2)}`)
  }
  if (event.isUrgent) descParts.push('Priority: URGENT')
  if (event.licensePlate) descParts.push(`Plate: ${event.licensePlate}`)
  if (event.vehicleMake || event.vehicleModel) {
    descParts.push(`Vehicle: ${[event.vehicleColor, event.vehicleMake, event.vehicleModel].filter(Boolean).join(' ')}`)
  }
  descParts.push(`ID: ${event.deliveryId}`)
  const description = descParts.join('\\n')

  // Escape special ICS characters in text fields
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

// ── Export / Share ───────────────────────────────────────────────────

/**
 * Trigger a .ics file download (fallback for desktop / unsupported browsers).
 */
function downloadICS(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Share via Web Share API if available, otherwise download the .ics file.
 *
 * Returns `true` if sharing was attempted (even if user cancelled),
 * `false` if the feature is unsupported and download was used instead.
 */
export async function exportCalendarEvent(event: CalendarEventInput): Promise<void> {
  const icsContent = buildICSFile(event)

  // Can't build a valid event without a start time
  if (!icsContent) {
    throw new Error('No scheduled pickup time available for this delivery.')
  }

  const filename = `delivery-${event.deliveryId}.ics`
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/calendar;charset=utf-8' })

  // Try Web Share API (works well on mobile — opens native share sheet)
  if (navigator.share && navigator.canShare) {
    const shareData: ShareData = {
      title: `Car Delivery: ${shortAddress(event.pickupAddress)} → ${shortAddress(event.dropoffAddress)}`,
      text: `Delivery from ${event.pickupAddress || 'TBD'} to ${event.dropoffAddress || 'TBD'}`,
      files: [file],
    }

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return // User shared (or cancelled) via native sheet
      } catch {
        // User cancelled the share sheet — not an error
        return
      }
    }
  }

  // Fallback: download the .ics file
  downloadICS(icsContent, filename)
}
