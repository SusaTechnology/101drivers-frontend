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

---
Task ID: 1
Agent: Main
Task: Fix delivery visibility - show all gigs with flags, fix dealer dashboard filter, fix timezone, fix controller session injection

Work Log:
- Analyzed complete delivery creation → dashboard → driver feed pipeline
- Found radius filter silently hiding beyond-radius gigs (return null)
- Found stacking-blocked gigs silently removed (return null)
- Found dealer dashboard "My" filter comparing User ID vs Customer ID (masked by || fallback)
- Found startTrip error message missing timezone in toLocaleTimeString
- Found controller not injecting session user as fallback for createdByUserId

Changes made:
1. `driver-job-feed.service.ts`: Radius filter now flags instead of hiding (matchScore -= 15, outsidePreferredRadius field). Stacking-blocked gigs now returned with reason instead of return null.
2. `dashboard-list.tsx`: Added stackingBlocked/outsidePreferredRadius to JobItem interface. GigCard shows amber ShieldX icon + tooltip for blocked gigs, blue Navigation icon for beyond-radius. Blocked gigs non-clickable with "Schedule Conflict" footer.
3. `dealer-dashboard.tsx`: Fixed createdById to use item.customer?.id instead of item.createdBy || item.customer?.id
4. `delivery-lifecycle.service.ts`: Added timeZone: "America/Los_Angeles" to toLocaleTimeString in startTrip first-pickup gate
5. `deliveryRequest.controller.ts`: Added @Req() request param to createDeliveryFromAcceptedQuote, auto-injects createdByUserId from authenticated session

Stage Summary:
- Commit f010523 pushed to master
- 5 files changed, 69 insertions, 15 deletions
- Zero new TS errors introduced
- Booking endpoint (assertDriverCanBookDelivery) still enforces stacking/radius at accept time — feed just shows more gigs with flags
