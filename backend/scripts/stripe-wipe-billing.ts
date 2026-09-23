/**
 * stripe-wipe-billing.ts — wipe ALL billing objects out of Stripe so billing
 * starts from zero, matching the DB wipe (scripts/wipe-transactional-data.sql).
 *
 * ⚠️  RUN THE DB WIPE AND THIS SCRIPT TOGETHER. Each one alone leaves the two
 * systems disagreeing:
 *   - DB wiped, Stripe not  → the 10+ pending InvoiceItems still land on each
 *     dealer's next weekly invoice → dealers get charged money we no longer
 *     show anywhere.
 *   - Stripe wiped, DB not  → dealer panel still shows outstanding balances.
 *
 * WHAT IT DOES (in order):
 *   1. Reports which Stripe mode you are on (TEST vs LIVE) and aborts LIVE
 *      deletes unless you pass --i-understand-this-is-live.
 *   2. Cancels + DELETES every active subscription immediately
 *      (no final invoice, no proration) — stops the weekly $0 anchor cycle.
 *   3. Deletes DRAFT invoices, VOIDS OPEN (finalized, unpaid) invoices.
 *   4. Deletes every PENDING InvoiceItem (the per-delivery usage rows and
 *      the negative referral-credit rows) — loop until none remain.
 *   5. REPORTS paid invoices (cannot be deleted — permanent Stripe record).
 *
 * WHAT IT KEEPS: Stripe customers + attached payment methods (saved cards),
 * so dealers don't have to re-add their cards.
 *
 * USAGE (from the backend folder):
 *   npx ts-node scripts/stripe-wipe-billing.ts                          # dry run — REPORT ONLY
 *   npx ts-node scripts/stripe-wipe-billing.ts --apply                   # TEST mode: delete
 *   npx ts-node scripts/stripe-wipe-billing.ts --apply --i-understand-this-is-live   # LIVE mode
 */

import "dotenv/config";
import Stripe from "stripe";

const APPLY = process.argv.includes("--apply");
const LIVE_OK = process.argv.includes("--i-understand-this-is-live");
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error(
    "STRIPE_SECRET_KEY not found. Run this from the backend folder so it loads backend/.env",
  );
  process.exit(1);
}

const isLive = secretKey.startsWith("sk_live");
if (isLive && APPLY && !LIVE_OK) {
  console.error(
    "\n⛔ REFUSING TO RUN: this is a LIVE Stripe key and you passed --apply.\n" +
      "   Real billing objects will be permanently deleted.\n" +
      "   If you are sure, re-run with: --apply --i-understand-this-is-live\n",
  );
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const money = (cents?: number | null) =>
  cents == null ? "?" : `$${(cents / 100).toFixed(2)}`;

async function main() {
  const acct = await stripe.accounts.retrieve(null);
  const mode = isLive ? "LIVE ⚠️  (real money)" : "TEST";
  console.log(`Stripe account: ${acct.id}  |  key: ${mode}`);
  console.log(
    `Run mode: ${APPLY ? "APPLY — objects WILL be deleted" : "DRY RUN — report only (add --apply to delete)"}`,
  );

  // ------------------------------------------------------------------ 1) subscriptions
  const subs = await stripe.subscriptions.list({ status: "all", limit: 100 });
  const liveSubs = subs.data.filter((s) =>
    ["active", "trialing", "past_due", "unpaid"].includes(s.status),
  );
  console.log(`\n1) Subscriptions to cancel + delete: ${liveSubs.length}`);
  for (const s of liveSubs) {
    const cust =
      typeof s.customer === "string" ? s.customer : s.customer?.id ?? "?";
    console.log(`   - ${s.id}  status=${s.status}  customer=${cust}`);
    if (APPLY) {
      // Immediate cancel; invoice_now:false + prorate:false → NO final invoice
      await stripe.subscriptions.cancel(s.id, {
        invoice_now: false,
        prorate: false,
      });
    }
  }

  // ------------------------------------------------------------------ 2) draft + open invoices
  const drafts = await stripe.invoices.list({ status: "draft", limit: 100 });
  console.log(`\n2) Draft invoices to delete: ${drafts.data.length}`);
  for (const inv of drafts.data) {
    console.log(`   - ${inv.id}  amount=${money(inv.amount_due)}`);
    if (APPLY) await stripe.invoices.del(inv.id);
  }

  const open = await stripe.invoices.list({ status: "open", limit: 100 });
  console.log(`   Open (finalized, unpaid) invoices to VOID: ${open.data.length}`);
  for (const inv of open.data) {
    console.log(`   - ${inv.id}  amount=${money(inv.amount_due)}  → voiding`);
    if (APPLY) await stripe.invoices.voidInvoice(inv.id);
  }

  // ------------------------------------------------------------------ 3) pending InvoiceItems
  // These are the per-delivery usage rows (USAGE_REPORTED in our DB) and the
  // negative referral-credit rows. Deleting them here is what stops Stripe
  // from billing them on the next weekly invoice.
  console.log(`\n3) Pending InvoiceItems to delete:`);
  let deleted = 0;
  for (;;) {
    const items = await stripe.invoiceItems.list({ limit: 100, pending: true });
    if (items.data.length === 0) break;
    for (const it of items.data) {
      const cust = typeof it.customer === "string" ? it.customer : it.customer?.id ?? "?";
      console.log(
        `   - ${it.id}  ${money(it.amount)}  customer=${cust}  ${(it.description ?? "").slice(0, 60)}`,
      );
      if (APPLY) await stripe.invoiceItems.del(it.id);
      deleted++;
    }
    if (!APPLY) break; // dry run: one page is enough for the report
  }
  if (deleted === 0) console.log(`   (none found — already clean)`);

  // ------------------------------------------------------------------ 4) paid invoices — report only
  const paid = await stripe.invoices.list({ status: "paid", limit: 100 });
  console.log(
    `\n4) PAID invoices: ${paid.data.length} ${paid.data.length ? "(cannot be deleted — permanent Stripe record; refund manually if needed)" : ""}`,
  );
  for (const inv of paid.data) {
    console.log(`   - ${inv.id}  amount=${money(inv.amount_paid)}  customer=${typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? "?"}`);
  }

  // ------------------------------------------------------------------ 5) summary
  console.log(`\n================ SUMMARY ================`);
  console.log(`Subscriptions cancelled+deleted : ${APPLY ? liveSubs.length : `${liveSubs.length} (dry run)`}`);
  console.log(`Draft invoices deleted          : ${APPLY ? drafts.data.length : `${drafts.data.length} (dry run)`}`);
  console.log(`Open invoices voided            : ${APPLY ? open.data.length : `${open.data.length} (dry run)`}`);
  console.log(`Pending InvoiceItems deleted    : ${APPLY ? deleted : `${deleted} (dry run)`}`);
  if (!APPLY) {
    console.log(
      `\nThis was a DRY RUN — nothing was changed. Re-run with --apply to execute.`,
    );
  } else {
    console.log(
      `\n✅ Stripe is clean. Now restart the backend and check a dealer panel:`,
    );
    console.log(`   - Outstanding amount  → should show $0.00`);
    console.log(`   - Next charge         → should show $0.00 (nothing charges this week)`);
    console.log(`   - No "Also in our records" block, no failure banners`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Stripe wipe failed:", err?.message ?? err);
    console.error("Nothing else was changed after the failing step — fix the");
    console.error("error and simply re-run (each delete is independent).");
    process.exit(1);
  });
