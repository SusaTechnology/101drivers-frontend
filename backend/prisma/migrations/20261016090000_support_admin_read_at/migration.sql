-- Support unread tracking for the admin support badge.
--
-- adminReadAt = when an ADMIN last opened the ticket's conversation
-- (POST /supportRequests/:id/mark-admin-read, called by the admin detail
-- page). A ticket counts as UNREAD for staff while the latest non-ADMIN
-- note (the original request message is also a note) is newer than
-- adminReadAt. Null adminReadAt = never opened by any admin.
--
-- Drives:
--   * GET /supportRequests/admin/unread-count  (navbar badge, socket-refreshed)
--   * unreadForAdmin / unreadMessages on GET /supportRequests/admin rows
--     (red dot + "N new" chip on the support list page)

ALTER TABLE "SupportRequest" ADD COLUMN "adminReadAt" TIMESTAMP(3);

-- Active queue scans filter by status (OPEN / IN_PROGRESS) and compute
-- unread against adminReadAt.
CREATE INDEX "SupportRequest_status_adminReadAt_idx" ON "SupportRequest"("status", "adminReadAt");
