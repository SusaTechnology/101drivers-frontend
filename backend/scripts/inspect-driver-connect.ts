// scripts/inspect-driver-connect.ts
//
// Read-only X-ray of driver Stripe Connect accounts. Shows, per account:
//   - capabilities actually on the account (expect transfers ONLY —
//     card_payments would mean we are asking drivers for business-level
//     onboarding they do not need)
//   - which pre-fill fields actually LANDED (name, phone, dob, ssn,
//     address, business_profile mcc/url/product_description, TOS)
//   - requirements.currently_due — EXACTLY what Stripe will still ask the
//     driver on the next onboarding link
//   - pending_verification + disabled_reason — why a step might be
//     locked or the account restricted
//
// Run this BEFORE touching code whenever a driver reports an onboarding
// question you don't expect: the currently_due list is the form they see.
//
// Usage (from the backend folder — needs STRIPE_SECRET_KEY in backend/.env):
//   npx ts-node scripts/inspect-driver-connect.ts                   # latest 10 accounts
//   npx ts-node scripts/inspect-driver-connect.ts acct_123          # one account
//   npx ts-node scripts/inspect-driver-connect.ts --all 50          # first 50 accounts
//
// Read-only: never writes to Stripe. Sensitive values (ssn, dob, address)
// are reported as set/UNSET, never printed.

import "dotenv/config";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("✗ STRIPE_SECRET_KEY missing from environment (backend/.env).");
  process.exit(1);
}
const stripe = new Stripe(key);

const set = (v: unknown): string =>
  v === null || v === undefined || v === "" ? "UNSET" : "set";

// Loosely typed on purpose: stripe v22's CJS typings hide the type
// namespace behind `export =`, so Stripe.Account is not reachable from
// the default import (same reason stripe.service.ts uses Record<string, any>).
function printAccount(acct: any): void {
  console.log(`\n──────── ${acct.id} ────────`);
  console.log(`email:            ${acct.email ?? "—"}`);
  console.log(`country:          ${acct.country}`);
  console.log(`business_type:    ${acct.business_type ?? "UNSET"}`);
  console.log(`capabilities:     ${JSON.stringify(acct.capabilities)}`);
  console.log(
    `payouts_enabled:  ${acct.payouts_enabled}   charges_enabled: ${acct.charges_enabled}`,
  );
  const bp: any = acct.business_profile ?? {};
  console.log(
    `business_profile: mcc=${bp.mcc ?? "UNSET"} url=${set(bp.url)} ` +
      `product_description=${set(bp.product_description)} support_phone=${set(bp.support_phone)}`,
  );
  const ind: any = acct.individual ?? {};
  console.log(
    `individual:       name=${ind.first_name ?? "?"} ${ind.last_name ?? ""} ` +
      `phone=${set(ind.phone)} dob=${set(ind.dob?.day)} ` +
      `ssn_last_4=${set(ind.ssn_last_4)} address=${set(ind.address?.line1)}`,
  );
  console.log(
    `currently_due:    ${JSON.stringify(acct.requirements?.currently_due ?? [])}`,
  );
  console.log(
    `pending_verify:   ${JSON.stringify(acct.requirements?.pending_verification ?? [])}`,
  );
  console.log(
    `disabled_reason:  ${acct.requirements?.disabled_reason ?? "none"}`,
  );
  console.log(`created:          ${new Date(acct.created * 1000).toISOString()}`);
}

async function main(): Promise<void> {
  const arg = process.argv[2];

  if (arg && arg.startsWith("acct_")) {
    const acct = await stripe.accounts.retrieve(arg);
    printAccount(acct);
    return;
  }

  const limit =
    arg === "--all" ? Number(process.argv[3] || 50) : 10;
  const list = await stripe.accounts.list({ limit: Math.min(limit, 100) });
  console.log(`Found ${list.data.length} connected account(s)`);
  for (const acct of list.data) printAccount(acct);
}

main().catch((err: any) => {
  console.error(`✗ ${err?.message ?? err}`);
  process.exit(1);
});
