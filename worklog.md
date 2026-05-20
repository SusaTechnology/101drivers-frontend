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

---
Task ID: 2
Agent: Main
Task: Fix same-day cutoff and radius rule — only enforce for TODAY, not future dates

Work Log:
- Analyzed two bugs with the same pattern: cutoff and radius checks don't distinguish today vs future
- Bug 1 (cutoff): Orchestrator blocks tomorrow deliveries because isSameCalendarDay(pickup,dropoff)=true triggers cutoff check even when pickup is tomorrow
- Bug 2 (radius): Driver feed blocks future gigs with 20-mile radius from today's last dropoff
- Fixed orchestrator (2 locations): added businessIsSameDay(pickupWindowStart, now) guard — cutoff only enforces when pickup is TODAY
- Fixed scheduling engine (1 location): CUT_OFF_PASSED reason only added when preferredDate is today
- Fixed driver feed (2 locations): radius check wrapped in businessIsSameDay guard — future bookings skip radius
- All changes use existing businessIsSameDay() from business-time.ts (America/Los_Angeles TZ)
- Pushed as commit 699facd on master

Stage Summary:
- 3 files modified: delivery-request-orchestrator.service.ts, schedulingPolicy.engine.ts, driver-job-feed.service.ts
- Tomorrow/later deliveries no longer blocked by today's cutoff time
- Future driver bookings no longer restricted by 20-mile same-day radius rule
- Time stacking checks unchanged (naturally handle multi-day via window non-overlap)
