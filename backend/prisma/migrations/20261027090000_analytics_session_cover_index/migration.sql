-- Cover index for the VISITS sessionization queries on the admin metrics
-- dashboard.
--
-- The visit counters run a LAG() window function PARTITIONED BY "sessionId"
-- ORDERED BY "occurredAt" over the PAGE_VIEW rows of a time window. The
-- existing (type, occurredAt) index finds the window rows but does NOT
-- carry "sessionId", so every row still needs a heap fetch before the
-- window sort. This index carries all three columns in the exact access
-- order — type equality, occurredAt range, sessionId payload — turning the
-- window input into an index-only scan.
--
-- Plain CREATE INDEX (transactional): for the expected ledger size this is
-- a seconds-long operation. On a much larger table, run the equivalent
-- CREATE INDEX CONCURRENTLY manually instead to avoid the write lock.

CREATE INDEX "AnalyticsEvent_type_occurredAt_sessionId_idx"
    ON "AnalyticsEvent"("type", "occurredAt", "sessionId");
