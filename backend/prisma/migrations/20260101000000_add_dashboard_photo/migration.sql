-- Add DASHBOARD_PHOTO to the EnumDeliveryEvidenceType enum.
--
-- This is purely additive: no existing rows are changed, no columns are
-- dropped, no constraints are added.  Old application code that doesn't
-- know about the new enum value continues to work because PostgreSQL
-- enum values are append-only and nullable for any row that doesn't
-- use them.
--
-- Safe to apply with `prisma migrate deploy` on a live server.

ALTER TYPE "EnumDeliveryEvidenceType" ADD VALUE IF NOT EXISTS 'DASHBOARD_PHOTO';
