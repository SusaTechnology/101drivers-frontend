-- Driver pipeline: ON_HOLD status.
-- Admins can park a pre-activation applicant (WAITLISTED / INVITED /
-- PENDING_APPROVAL) as ON_HOLD without rejecting them — e.g. driver
-- oversupply in a region, or a region that is not launching yet. The
-- record stays in the system and can be revisited (released or rejected).
-- Also adds the matching audit actions so every hold / release is logged
-- with actor, timestamp, reason, and before/after JSON in AdminAuditLog.
ALTER TYPE "EnumDriverStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "EnumAdminAuditLogAction" ADD VALUE IF NOT EXISTS 'DRIVER_HOLD';
ALTER TYPE "EnumAdminAuditLogAction" ADD VALUE IF NOT EXISTS 'DRIVER_RELEASE';
