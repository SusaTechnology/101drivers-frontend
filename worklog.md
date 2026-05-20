---
Task ID: 1
Agent: Main
Task: Fix driver job feed — enable gig stacking within same time slot

Work Log:
- Analyzed the root cause: window-based overlap check blocks all gigs sharing the same 2-hour slot
- Fixed orphan assignment bug in delivery-lifecycle.service.ts (BOOKED→LISTED now sets unassignedAt)
- Added stackingBlocked field to DriverFeedItem type
- Reduced DEFAULT_TRANSIT_BUFFER_MINUTES from 45 to 15
- Rewrote feed filter stacking logic (lines 412-591): uses estimatedFinish (pickupStart + etaMinutes) + haversine drive time + small buffer instead of raw window overlap
- Rewrote booking validation stacking logic (lines 985-1197): uses Google Maps route duration + haversine fallback instead of flat 45-min buffer
- Updated frontend driver-dashboard.tsx: GigCard shows amber "Can't book" badge for blocked gigs, AlertDialog explains why, no navigation to detail page for blocked gigs
- Bottom sheet Accept button disabled for blocked gigs

Stage Summary:
- Files modified: delivery-lifecycle.service.ts, driver-job-feed.service.ts, driver-dashboard.tsx
- Drivers can now book multiple short deliveries within the same 2-hour slot
- Stacking check: estimatedFinish_prev + driveTime + 15min buffer ≤ nextPickup
- Non-stackable gigs still appear in feed with explanation dialog
- Backend compiles cleanly (no new errors)
