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
 *   2. Cancels + DELETES every active dealer subscription immediately
 *      (no final invoice, no proration) — stops the weekly $0 anchor cycle.
 *   3. Deletes DRAFT invoices, VOIDS OPEN (finalized, unpaid) invoices.
 *   4. Deletes every PENDING InvoiceItem (the per-delivery usage rows and
 *      the negative referral-credit rows) — loop until none remain.
 *   5. REPORTS paid invoices + past transfers (cannot be deleted — permanent
 *      Stripe records; in LIVE mode refund/handle money manually first).
 *   6. OPTIONAL (--also-delete-connect-accounts): deletes driver Connect
 *      Express accounts too. DEFAULT: kept, so drivers do NOT have to redo
 *      identity verification + bank details. Only use when drivers are
 *      test-only — and pair it with the commented Driver UPDATE in
 *      wipe-transactional-data.sql (both or neither).
 *
 * WHAT IT KEEPS: Stripe customer records + attached payment methods (dealer
 * saved cards), and by default driver Connect accounts.
 *
 * USAGE (from the backend folder):
 *   npx ts-node scripts/stripe-wipe-billing.ts                          # dry run — REPORT ONLY
 *   npx ts-node scripts/stripe-wipe-billing.ts --apply                   # TEST mode: delete
 *   npx ts-node scripts/stripe-wipe-billing.ts --apply --i-understand-this-is-live   # LIVE mode
 *   npx ts-node scripts/stripe-wipe-billing.ts --apply --also-delete-connect-accounts
 */

import "dotenv/config";
import Stripe from "stripe";

const APPLY = process.argv.includes("--apply");
const CONNECT = process.argv.includes("--also-delete-connect-accounts");
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

// One failing object (e.g. a Connect account with a pending balance) must not
// abort the whole wipe — collect failures, keep going, report at the end.
const failures: string[] = [];
async function attempt(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    failures.push(`${label}: ${msg}`);
    console.log(`     ⚠️ FAILED (${label}): ${msg}`);
  }
}

async function main() {
  const acct = await stripe.accounts.retrieve(null);
  const mode = isLive ? "LIVE ⚠️  (real money)" : "TEST";
  console.log(`Stripe account: ${acct.id}  |  key: ${mode}`);
  console.log(
    `Run mode: ${APPLY ? "APPLY — objects WILL be deleted" : "DRY RUN — report only (add --apply to delete)"}`,
  );
  if (CONNECT) {
    console.log(
      `Connect accounts: ${APPLY ? "DELETE requested" : "would be listed"} (--also-delete-connect-accounts)`,
    );
  }

  // ------------------------------------------------------------------ 1) dealer subscriptions (postpaid)
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
      await attempt(`cancel ${s.id}`, () =>
        stripe.subscriptions.cancel(s.id, {
          invoice_now: false,
          prorate: false,
        }),
      );
    }
  }

  // ------------------------------------------------------------------ 2) draft + open invoices
  const drafts = await stripe.invoices.list({ status: "draft", limit: 100 });
  console.log(`\n2) Draft invoices to delete: ${drafts.data.length}`);
  for (const inv of drafts.data) {
    console.log(`   - ${inv.id}  amount=${money(inv.amount_due)}`);
    if (APPLY) await attempt(`delete draft ${inv.id}`, () => stripe.invoices.del(inv.id));
  }

  const open = await stripe.invoices.list({ status: "open", limit: 100 });
  console.log(`   Open (finalized, unpaid) invoices to VOID: ${open.data.length}`);
  for (const inv of open.data) {
    console.log(`   - ${inv.id}  amount=${money(inv.amount_due)}  → voiding`);
    if (APPLY)
      await attempt(`void ${inv.id}`, () => stripe.invoices.voidInvoice(inv.id));
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
      const cust =
        typeof it.customer === "string" ? it.customer : it.customer?.id ?? "?";
      console.log(
        `   - ${it.id}  ${money(it.amount)}  customer=${cust}  ${(it.description ?? "").slice(0, 60)}`,
      );
      if (APPLY)
        await attempt(`delete item ${it.id}`, () => stripe.invoiceItems.del(it.id));
      deleted++;
    }
    if (!APPLY) break; // dry run: one page is enough for the report
  }
  if (deleted === 0) console.log(`   (none found — already clean)`);

  // ------------------------------------------------------------------ 4) permanent records — report only
  const paid = await stripe.invoices.list({ status: "paid", limit: 100 });
  console.log(
    `\n4) PAID invoices: ${paid.data.length} ${paid.data.length ? "(cannot be deleted — permanent Stripe record; refund manually if needed)" : ""}`,
  );
  for (const inv of paid.data) {
    const cust =
      typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? "?";
    console.log(
      `   - ${inv.id}  amount=${money(inv.amount_paid)}  customer=${cust}`,
    );
  }

  const transfers = await stripe.transfers.list({ limit: 100 });
  console.log(
    `   Past driver payout transfers: ${transfers.data.length} (permanent records — not deletable)`,
  );

  // ------------------------------------------------------------------ 5) driver Connect accounts — OPTIONAL
  const accounts = await stripe.accounts.list({ limit: 100 });
  console.log(`\n5) Driver Connect accounts found: ${accounts.data.length}`);
  for (const acc of accounts.data) {
    const driverId = acc.metadata?.driverId ?? "?";
    console.log(
      `   - ${acc.id}  type=${acc.type}  driverId=${driverId}  charges_enabled=${acc.charges_enabled}`,
    );
  }
  if (CONNECT) {
    if (APPLY) {
      console.log(
        `   → Deleting all ${accounts.data.length} (drivers must re-onboard afterwards!)`,
      );
      for (const acc of accounts.data) {
        await attempt(`delete connect ${acc.id}`, () =>
          stripe.accounts.del(acc.id),
        );
      }
      console.log(
        `   ⚠️ Remember to run the commented Driver UPDATE in wipe-transactional-data.sql,`,
      );
      console.log(
        `      otherwise Driver rows still point at deleted accounts (breaks payouts until re-onboarded).`,
      );
    } else {
      console.log(
        `   → DRY RUN: re-run with --apply --also-delete-connect-accounts to delete them.`,
      );
    }
  } else {
    console.log(`   → KEPT by default (drivers keep onboarding + bank details).`);
  }

  // ------------------------------------------------------------------ 6) summary
  console.log(`\n================ SUMMARY ================`);
  console.log(
    `Subscriptions cancelled+deleted : ${APPLY ? liveSubs.length : `${liveSubs.length} (dry run)`}`,
  );
  console.log(
    `Draft invoices deleted          : ${APPLY ? drafts.data.length : `${drafts.data.length} (dry run)`}`,
  );
  console.log(
    `Open invoices voided            : ${APPLY ? open.data.length : `${open.data.length} (dry run)`}`,
  );
  console.log(
    `Pending InvoiceItems deleted    : ${APPLY ? deleted : `${deleted} (dry run)`}`,
  );
  console.log(
    `Connect accounts deleted        : ${CONNECT && APPLY ? accounts.data.length : CONNECT ? `${accounts.data.length} (dry run)` : "0 (kept by default)"}`,
  );
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} step(s) FAILED (see ⚠️ lines above);`);
    console.log(
      `    everything else was completed. Fix the cause and simply re-run —`,
    );
    console.log(`    each delete is independent and already-deleted objects are skipped.`);
    process.exit(1);
  }
  if (!APPLY) {
    console.log(
      `\nThis was a DRY RUN — nothing was changed. Re-run with --apply to execute.`,
    );
  } else {
    console.log(
      `\n✅ Stripe is clean. Now restart the backend and check a dealer panel:`,
    );
    console.log(`   - Outstanding amount  → should show $0.00`);
    console.log(
      `   - Next charge         → should show $0.00 (nothing charges this week)`,
    );
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
