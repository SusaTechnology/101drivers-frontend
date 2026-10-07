-- PaymentEvent CAPTURE de-duplication — DB-enforced, race-free
--
-- WHY: several in-process writers record CAPTURE audit rows
--   • orchestrator recordInstantCapturePaymentEvent (private instant
--     capture at creation)          — providerRef = PaymentIntent id
--   • lifecycle lock-in fee capture — providerRef = charge id (ch_…)
--   • payout-engine remainder capture (new PI) — providerRef = PI id
--   • payout-engine legacy full capture — providerRef = NULL
-- and the payment_intent.succeeded webhook writes its own "Payment
-- succeeded via webhook" CAPTURE row. Until now the webhook's only guard
-- was the stripeEventId unique constraint — which in-process rows (whose
-- stripeEventId IS NULL) bypass. So whenever a webhook IS processed for a
-- PI that an in-process path already recorded, two rows describe the same
-- single capture.
--
-- FIX: partial unique index instead of app-level check-then-insert.
-- A Stripe PaymentIntent captures exactly once, so a (paymentId,
-- providerRef) collision among CAPTURE rows is a true duplicate by
-- construction — the DB decides, and any future writer (cron, admin
-- tool, event replay) is deduped for free. The index is partial because:
--   • providerRef IS NULL rows (legacy full capture) must stay allowed —
--     Postgres unique indexes treat NULLs as distinct; kept explicit so
--     the intent survives review
--   • only CAPTURE rows participate; AUTHORIZE/FAIL/REFUND events share
--     providerRef conventions freely and are untouched
--
-- Step 1 — remove pre-existing duplicates so index creation can succeed.
--          Preview with the SELECTs (left commented) before deploying.
--
-- 1a) webhook twin of an in-process row: KEEP the in-process row (it
--     carries the accurate business message), delete the webhook twin.
--
-- SELECT a."id", a."message", a."stripeEventId" FROM "PaymentEvent" a
-- JOIN "PaymentEvent" b ON a."paymentId" = b."paymentId"
--   AND a."providerRef" = b."providerRef" WHERE ... (same predicates as DELETE);
DELETE FROM "PaymentEvent" a
USING "PaymentEvent" b
WHERE a."type" = 'CAPTURE'::"EnumPaymentEventType"
  AND b."type" = 'CAPTURE'::"EnumPaymentEventType"
  AND a."paymentId" = b."paymentId"
  AND a."providerRef" = b."providerRef"
  AND a."providerRef" IS NOT NULL
  AND a."stripeEventId" IS NOT NULL
  AND b."stripeEventId" IS NULL
  AND a."id" <> b."id";

-- 1b) webhook-vs-webhook replays of the same capture (same PI delivered
--     under different event ids): keep the earliest, drop later ones.
--
-- SELECT a."id", a."message", a."stripeEventId" FROM "PaymentEvent" a
-- JOIN "PaymentEvent" b ON a."paymentId" = b."paymentId"
--   AND a."providerRef" = b."providerRef" WHERE ... (same predicates as DELETE);
DELETE FROM "PaymentEvent" a
USING "PaymentEvent" b
WHERE a."type" = 'CAPTURE'::"EnumPaymentEventType"
  AND b."type" = 'CAPTURE'::"EnumPaymentEventType"
  AND a."paymentId" = b."paymentId"
  AND a."providerRef" = b."providerRef"
  AND a."providerRef" IS NOT NULL
  AND a."stripeEventId" IS NOT NULL
  AND b."stripeEventId" IS NOT NULL
  AND (a."createdAt" > b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- Step 2 — enforce for every future writer. Plain CREATE UNIQUE INDEX
-- (transactional): PaymentEvent is payments × a handful of rows, so the
-- brief build lock is acceptable; CONCURRENTLY cannot run inside the
-- migration transaction.
CREATE UNIQUE INDEX "payment_event_capture_provider_unique"
ON "PaymentEvent"("paymentId", "providerRef")
WHERE "type" = 'CAPTURE'::"EnumPaymentEventType" AND "providerRef" IS NOT NULL;
