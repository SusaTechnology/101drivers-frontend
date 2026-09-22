# Billing Runbook — Postpaid Dealer Billing Failures

Operational runbook for the weekly postpaid billing system (Stripe invoices +
anchor subscription). Covers every failure class we have seen in production
or testing, how to identify it, and the exact fix.

Quick links:

- Dealer list needing help: **Admin → Billing Health** (`/admin-billing-health`)
- Nightly audit: runs 4AM server time — audits every WEEKLY_POSTPAID dealer
  against Stripe, auto-repairs safe drift, records findings, emails
  `BILLING_OPS_EMAIL` (if configured) and backfills missed webhooks.

---

## The one concept to understand

There are **two "default payment methods"** in the system:

1. **Our DB** — `Customer.stripeDefaultPaymentMethodId` (bookkeeping).
2. **Stripe's** — `Customer.invoice_settings.default_payment_method` (what
   `POST /v1/invoices/:id/pay` actually charges).

Weekly billing works like this: each dealer has a **$0/week anchor
subscription** (billing cycle anchor, appears as a $0.00 line on every
invoice — that is *by design*, not a bug). Deliveries are added as invoice
items during the week. Stripe finalizes the invoice and charges the customer's
**Stripe-side** default card. If that field is empty, the charge fails with:

```
"error": { "code": "missing", "type": "invalid_request_error",
  "message": "There is no `default_payment_method` set on the associated
  Customer, Invoice, or Subscription..." }
```

Our code normally keeps them in sync (`setup_intent.succeeded` webhook sets
both + verifies), but drift can still happen. The classes below cover it.

---

## Failure class 1 — No default card on Stripe (drift)

**Symptom:** repeated 402 `missing` on `/v1/invoices/:id/pay` in Stripe logs;
dealer may be frozen; our DB may still show `stripeDefaultPaymentMethodId`
set (that's the drift).

**Detect:** the nightly audit records a `DEFAULT_PM_DRIFT` finding → Billing
Health → "Reconciliation findings". Auto-repair fixes it automatically when
the DB card is still attached to the right Stripe customer.

**Fix (any one):**
1. Billing Health → finding card → **"Repair default from DB"** button.
2. Stripe dashboard → Customer → Payment methods → set card as default.
3. Dealer re-saves their card in the app (webhook sets + verifies default,
   then immediately retries open invoices — "pay-kick").

## Failure class 2 — Card not attached / attached elsewhere

**Symptom:** `PM_NOT_ATTACHED` finding (CRITICAL). The card in our DB is
detached or attached to a different Stripe customer. No auto-repair possible.

**Fix:** the dealer re-saves their card in the app. Nothing else works —
a payment method can only be a default if it is attached to that customer.

## Failure class 3 — Subscription bills a different Stripe customer

**Symptom:** `SUBSCRIPTION_CUSTOMER_MISMATCH` finding (CRITICAL). The anchor
subscription invoices customer X while our DB (and any saved cards) point at
customer Y. Cards saved on Y never reach the invoices. This is the sneakiest
class — everything looks fine in our DB.

**Fix (deliberate admin action, no auto-repair):**
1. Prefer: re-run the postpaid setup for the dealer so subscription and
   customer match (contact engineering if the endpoint refuses because one
   already exists).
2. Or set a default card directly on the customer the subscription bills
   (unblocks invoices immediately), then schedule the real fix.

## Failure class 4 — No card at all

**Symptom:** `NO_SAVED_CARD` finding (WARNING). Since the CARD_REQUIRED gate,
postpaid dealers cannot create deliveries without a card, so this only
persists for dealers onboarded before the gate.

**Fix:** dealer saves a card in the app. Cron retries open invoices
automatically afterwards (or admin Billing Health → retry).

---

## Finding the dealer behind a Stripe error

From a Stripe log entry (Workbench → logs), open the **invoice id**
(`in_…`) shown in the request path → the invoice page names the customer.
Our Stripe customers carry `metadata.customerId` = our internal dealer id.

Or, from our DB (multiple rows = multiple deliveries in the same weekly
cycle — all the same dealer):

```bash
psql "$DATABASE_URL" -x -c "
SELECT p.\"stripeInvoiceId\", p.status AS payment_status, p.\"failureMessage\",
       c.id AS dealer_id, c.\"businessName\", c.\"contactEmail\",
       c.\"stripeCustomerId\", c.\"billingFrozen\"
FROM \"Payment\" p
JOIN \"DeliveryRequest\" d ON d.\"id\" = p.\"deliveryId\"
JOIN \"Customer\"        c ON c.\"id\" = d.\"customerId\"
WHERE p.\"stripeInvoiceId\" = 'in_PASTE_HERE';"
```

Fallback (no rows): copy the `cus_…` from the invoice's customer page, then

```bash
psql "$DATABASE_URL" -x -c "
SELECT id, \"businessName\", \"contactEmail\", \"billingFrozen\", \"billingFrozenReason\"
FROM \"Customer\" WHERE \"stripeCustomerId\" = 'cus_PASTE_HERE';"
```

---

## What heals itself (no human needed)

| Situation | Self-healing path |
|---|---|
| Payment failed, card fixed later | Hourly cron + card-save pay-kick retry open invoices → `invoice.payment_succeeded` → rows flip PAID + dealer auto-unfreezes |
| Missed webhook (endpoint down) | Nightly 4AM backfill re-runs the idempotent invoice handlers for the last 48h |
| DB/Stripe default drift (card still attached) | Nightly audit auto-repairs + records finding |
| Invoice voided / marked uncollectible | Write-off webhook handlers close the rows; frozen dealers unfreeze — no dead ends |
| Dealer saved no card | CARD_REQUIRED gate blocks new deliveries; graduated banners + emails guide them |

## Escalation path

1. Check **Billing Health** — findings section explains each issue with next
   steps.
2. Check Stripe dashboard → Developers → Webhooks → endpoint delivery log
   (a red endpoint is the root cause of many mysteries).
3. Run the psql queries above for ground truth in our DB.
4. When everything looks right but charges still fail: the card itself is
   declining — the dealer needs a different card (Stripe error on the
   payment attempt says which).
