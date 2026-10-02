-- PayoutSweepRun: one row per weekly sweep execution (cron tick or admin
-- manual trigger). This is the admin-facing weekly transfer report record:
-- how many driver transfers the run attempted, how many succeeded, how many
-- failed — with per-driver detail (amount, status, failure reason) readable
-- from the linked PayoutBatch rows.
--
-- PayoutBatch.runId links each batch created by a sweep to its run so the
-- admin report can list exactly which drivers were paid and which failed
-- (and why) for any given weekly transfer day.
--
-- trigger/status are plain TEXT with app-level validation
-- ("CRON" | "MANUAL" / "RUNNING" | "COMPLETED") — no new enum types, so
-- this migration has no ALTER TYPE ownership concerns.

-- CREATE TABLE
CREATE TABLE "PayoutSweepRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'CRON',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "PayoutSweepRun_pkey" PRIMARY KEY ("id")
);

-- Index for the admin report list (latest runs first)
CREATE INDEX "PayoutSweepRun_startedAt_idx" ON "PayoutSweepRun"("startedAt");

-- Link PayoutBatch rows created by a sweep to their run
ALTER TABLE "PayoutBatch" ADD COLUMN "runId" TEXT;

CREATE INDEX "PayoutBatch_runId_idx" ON "PayoutBatch"("runId");

ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayoutSweepRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
