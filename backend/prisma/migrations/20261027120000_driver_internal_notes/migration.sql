-- Admin-only internal notes for the Driver Profile page ("Internal Notes").
-- Standalone table on purpose: a Driver column would leak through every
-- whole-model Driver return (onboarding, waitlist listings); this model is
-- only ever touched by the admin endpoints that select it explicitly.

CREATE TABLE "DriverInternalNote" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "notes" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverInternalNote_pkey" PRIMARY KEY ("id")
);

-- One scratchpad per driver.
CREATE UNIQUE INDEX "DriverInternalNote_driverId_key" ON "DriverInternalNote"("driverId");

-- The note dies with the driver row — a satellite must never block user cleanup.
ALTER TABLE "DriverInternalNote" ADD CONSTRAINT "DriverInternalNote_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
