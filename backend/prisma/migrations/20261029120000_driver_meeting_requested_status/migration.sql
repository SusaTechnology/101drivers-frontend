-- Driver lifecycle: MEETING_REQUESTED status.
-- From PENDING_APPROVAL the admin can either Approve outright (skip the
-- meeting) or send the scheduling email — the email + the status flip to
-- MEETING_REQUESTED happen in ONE backend transaction, so a failed email
-- rolls the status change back and vice versa. The status stays distinct
-- from PENDING_APPROVAL so admins always see who has been contacted.
-- Also adds the audit action so every meeting request is logged with
-- actor, timestamp, the exact email message, and before/after JSON.
ALTER TYPE "EnumDriverStatus" ADD VALUE IF NOT EXISTS 'MEETING_REQUESTED';
ALTER TYPE "EnumAdminAuditLogAction" ADD VALUE IF NOT EXISTS 'DRIVER_MEETING_REQUEST';
