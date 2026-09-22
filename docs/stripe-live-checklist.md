# Stripe Live-Mode Cutover Checklist

Everything that must exist in Stripe **live mode** before switching the
platform to live keys. Stripe test/live objects are fully separate — nothing
migrates automatically.

---

## 1. Create the billing anchor price (live mode)

- Products → Add product → e.g. "Delivery — Postpaid (weekly anchor)".
- Pricing: **recurring, metered, $0.00/unit per week** (weekly interval).
  The price is a billing-cycle anchor only — real charges are the
  per-delivery invoice items added by our system.
- Copy the **live** `price_…` id.

> The test-mode price id does NOT exist in live mode. Every weekly invoice
> is created from this price — without it, dealer onboarding fails.

## 2. Create the live webhook endpoint

- Developers → Webhooks → Add endpoint (live mode).
- URL: `https://<your-api-domain>/api/stripe/webhook` (note: api prefix +
  raw-body route — identical to the test endpoint).
- Events — the verified required list (16, mechanically derived from our
  webhook handler; the handler ignores unknown events with a 200):

  | Event | Why we need it |
  |---|---|
  | `account.updated` | Connect account status for driver payouts |
  | `charge.refunded` | Mark payments refunded |
  | `charge.dispute.created` | Record chargeback + clawback from driver payout |
  | `charge.dispute.closed` | Resolve dispute (won → restore) |
  | `invoice.upcoming` | Attach invoice summary description |
  | `invoice.finalized` | Track open invoice lifecycle |
  | `invoice.payment_succeeded` | Mark payments PAID + auto-unfreeze dealer |
  | `invoice.payment_failed` | Mark CHARGE_FAILED + freeze dealer |
  | `invoice.voided` | Close written-off invoices cleanly |
  | `invoice.marked_uncollectible` | Same, for the uncollectible path |
  | `payment_intent.amount_capturable_updated` | Prepaid authorized email |
  | `payment_intent.succeeded` | Prepaid capture flow |
  | `payment_intent.payment_failed` | Prepaid failure states |
  | `payment_intent.canceled` | Prepaid cancel cleanup |
  | `setup_intent.succeeded` | **Critical:** sets + verifies the Stripe invoice default card; triggers the open-invoice pay-kick |
  | `transfer.created` | Driver payout tracking |

  Optional extras our handler safely logs-and-ACKs: `charge.failed`,
  `invoice.paid`, `transfer.reversed`, `transfer.updated`.
  `customer.subscription.*` is **not needed** — we create/manage
  subscriptions via API and store the ids ourselves (harmless to add).
- Copy the **live** `whsec_…` signing secret.

## 3. Collect the live keys

| Purpose | Where | Our env key |
|---|---|---|
| Secret key | Developers → API keys | `STRIPE_SECRET_KEY` |
| Publishable key | Developers → API keys | frontend `VITE_STRIPE_*` / publishable env |
| Webhook signing secret | step 2 above | `STRIPE_WEBHOOK_SECRET` |
| Anchor price | step 1 above | `STRIPE_POSTPAID_PRICE_ID` |
| Connect (driver payouts) | Connect settings | any Connect-related keys our env uses |

Switch them in the backend env, then restart. Zero code changes — everything
is env-driven; test mode stays intact for staging under the old keys.

## 4. Set the ops email (recommended)

- `BILLING_OPS_EMAIL` = who receives the daily billing digest (frozen
  dealers, CRITICAL/WARNING audit findings, no-card dealers). Quiet days
  send nothing. Without it the digest is skipped (logged only).

## 5. Live smoke test (first real dealer)

1. Onboard/approve a real dealer with a real card.
2. In our logs, confirm: `Set Stripe invoice_settings.default_payment_method
   pm_… (verified by re-read)`.
3. Create a delivery — the CARD_REQUIRED gate must not block (card exists).
4. Wait for the first weekly invoice (or trigger the cycle) → confirm it
   charges the card and `invoice.payment_succeeded` returns 200 in the live
   webhook log.
5. Billing Health page: dealer is healthy, zero findings.
6. Optionally test the failure path: remove the card in Stripe, force an
   invoice attempt → dealer freezes, banner appears; re-save card →
   auto-unfreeze within seconds (pay-kick).

## 6. Expectations for live data

- **No cards migrate from test.** Every dealer must save a card once in live
  mode — the CARD_REQUIRED gate catches them at their first delivery and the
  review-step dialog captures it ("you'll be invoiced weekly — you don't pay
  now").
- The nightly reconciliation + backfill + digest run in live mode exactly as
  described in `docs/billing-runbook.md`.
