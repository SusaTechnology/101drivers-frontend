/**
 * Shared singleton tracker for driver feed notifications.
 *
 * Module-level state — persists across all page navigations within the same
 * browser session.  When the user refreshes the tab the module re-initialises
 * (seenIds resets, count resets), which is the desired behaviour.
 *
 * Responsibilities:
 *   1. Track which delivery IDs the driver has already "seen" on the feed.
 *   2. Maintain an unread-new-delivery count (for the bottom-nav badge).
 *   3. Play the notification sound only for genuinely new LISTED deliveries
 *      (delegates to sound.ts for preloaded audio + AudioContext fallback).
 *   4. Notify subscribers whenever the unread count changes.
 *
 * Used by:
 *   - socket.ts               → single shared `delivery:feed-update` listener
 *   - driver-dashboard-map.tsx → registers refetch callback + marks deliveries as seen
 *   - dashboard-list.tsx       → registers refetch callback + marks deliveries as seen
 *   - DriverBottomNav.tsx      → subscribes to count for badge
 */

import { playNotificationSound } from './sound'

// ── Types ──────────────────────────────────────────────────────────────────
type Subscriber = (count: number) => void
type RefetchCallback = (data: { deliveryId?: string; status: string }) => void

// ── Module-level state ────────────────────────────────────────────────────
const seenIds = new Set<string>()
const subscribers = new Set<Subscriber>()
const refetchCallbacks = new Set<RefetchCallback>()
let unreadNewCount = 0
let initialDataLoaded = false

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Mark a batch of delivery IDs as "already seen".
 * Call this when a feed API response arrives so those deliveries are never
 * treated as "new" again (until the next page refresh).
 *
 * Also resets the unread count to 0 because the driver is now looking at the
 * feed — the badge should disappear.
 */
export function trackSeenDeliveries(ids: string[]): void {
  initialDataLoaded = true
  for (const id of ids) {
    if (id) seenIds.add(id)
  }
  setCount(0)
}

/**
 * Handle an incoming `delivery:feed-update` socket event.
 *
 * • If status is LISTED and the delivery has NOT been seen before:
 *     – add to seen set (prevent double-trigger)
 *     – increment unread count
 *     – play notification sound (via sound.ts)
 * • If status is BOOKED / CANCELLED / EXPIRED:
 *     – no sound (those are removals, not new gigs)
 * • ALWAYS forwards the event to every registered refetch callback so the
 *   active dashboard page can refresh its data.
 *
 * Race-condition gate: events received before the very first feed load are
 * silently dropped (`initialDataLoaded === false`).  This prevents a false
 * beep when a LISTED socket event arrives in the gap between mount and the
 * API response.
 */
export function handleFeedEvent(
  data: { deliveryId?: string; status: string },
): void {
  if (!data?.deliveryId) return

  if (data.status === 'LISTED') {
    if (!initialDataLoaded) return // race gate
    if (!seenIds.has(data.deliveryId)) {
      seenIds.add(data.deliveryId)
      setCount(unreadNewCount + 1)
      playNotificationSound()
    }
  }

  // Trigger refetch in whichever dashboard page is currently active
  refetchCallbacks.forEach((cb) => cb(data))
}

/**
 * Subscribe to unread-count changes.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function subscribe(cb: Subscriber): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

/**
 * Register a refetch callback for the currently-active dashboard page.
 * The shared socket listener calls every registered callback on each
 * `delivery:feed-update` event so the page can refresh its feed data.
 *
 * Returns an unsubscribe function.
 */
export function registerRefetch(cb: RefetchCallback): () => void {
  refetchCallbacks.add(cb)
  return () => {
    refetchCallbacks.delete(cb)
  }
}

/**
 * Get the current unread count (for non-React contexts).
 */
export function getNewCount(): number {
  return unreadNewCount
}

// ── Internal helpers ──────────────────────────────────────────────────────

function setCount(n: number): void {
  unreadNewCount = n
  subscribers.forEach((cb) => cb(n))
}
