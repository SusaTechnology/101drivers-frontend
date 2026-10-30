// pageHeading.ts — data for the navbar's "where am I" block.
//
// Derives the breadcrumb + page title shown in the LEFT hemisphere of the
// admin navbar (right after the brand mark, where the logo sits):
//   gray sub-header  → the breadcrumb path, e.g. "ADMIN / USERS"
//   bold header      → the title of the page we are on, e.g. "Users"
//
// It resolves purely from the router pathname, and it lives INSIDE the
// persistent shell (the Navbar is mounted once by <AdminShell>), so it
// updates live on every navigation with zero per-page wiring and zero
// remounts — the same trick the global Back button uses.
//
// Resolution order:
//   1. SUB_PAGES  — detail / sub pages mapped to their parent section plus
//      an explicit title. Titles mirror what the pages and the Config Hub
//      actually call them (verified against admin-config.tsx card titles).
//   2. navItems   — a top-level admin section: crumb "Admin / <Label>",
//      title "<Label>".
//   3. Fallback   — crumb "Admin", title prettified from the last path
//      segment ("/admin-some-new-page" → "Some New Page"), so a freshly
//      added route is never a raw slug in the header.

import { navItems } from './navItems';

export interface PageHeading {
  /** Gray sub-header line — the breadcrumb path, e.g. "Admin / Users". */
  crumb: string;
  /** Bold header line — the title of the page we are on. */
  title: string;
}

/** Detail / sub page → [parent section label, page title]. */
const SUB_PAGES: Record<string, [string, string]> = {
  // User area
  '/admin-user-detail': ['Users', 'User Details'],
  '/admin-dealer-detail': ['Users', 'Dealer Details'],
  // Operations
  '/admin-delivery-detail': ['Deliveries', 'Delivery Details'],
  '/admin-support-detail': ['Support', 'Support Ticket'],
  '/admin-dispute-detail': ['Disputes', 'Dispute Details'],
  // Money
  '/admin-payment-detail': ['Payments', 'Payment Details'],
  '/admin-payout-detail': ['Payments', 'Payout Details'],
  '/admin-payout-run-detail': ['Payments', 'Payout Run Details'],
  '/admin-billing-health': ['Payments', 'Billing Health'],
  // Pricing
  '/admin-pricing-rule': ['Pricing', 'Pricing Rule'],
  '/admin-pricing-config': ['Pricing', 'Pricing Config'],
  // Reports
  '/admin-report-deliveries': ['Reports', 'Deliveries Report'],
  '/admin-report-disputes': ['Reports', 'Disputes Report'],
  '/admin-report-payments': ['Reports', 'Payments Report'],
  '/admin-report-payouts': ['Reports', 'Payouts Report'],
  '/admin-report-compliance': ['Reports', 'Compliance Report'],
  '/admin-report-ops-summary': ['Reports', 'Ops Summary Report'],
  // Config Hub children (titles = the hub's own card titles)
  '/admin-delivery-policies': ['Config', 'Delivery Policies'],
  '/admin-service-area': ['Config', 'Service Area'],
  '/admin-service-districts': ['Config', 'Service Districts'],
  '/admin-notification-policy': ['Config', 'Notification Policy'],
  '/admin-landing-page-settings': ['Config', 'Home Page Settings'],
  '/admin-referral-program': ['Config', 'Referral Program'],
  '/admin-content': ['Config', 'Content Editor'],
};

/** "/admin-some-new-page" → "Some New Page" (last segment, humanized). */
function prettifySegment(pathname: string): string {
  const last = pathname.split('/').filter(Boolean).pop() ?? '';
  return last
    .replace(/^admin-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function pageHeading(pathname: string): PageHeading {
  // 1) Detail / sub pages first — their paths never equal a nav href, but
  //    checking them first keeps intent explicit.
  const sub = Object.keys(SUB_PAGES).find(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  if (sub) {
    const [parent, title] = SUB_PAGES[sub];
    return { crumb: `Admin / ${parent}`, title };
  }

  // 2) Top-level admin section. startsWith(href + '/') (not a bare
  //    startsWith) so "/admin-user-detail" can never match "/admin-users".
  const item = navItems.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/'),
  );
  if (item) return { crumb: `Admin / ${item.label}`, title: item.label };

  // 3) Unmapped route — never a raw slug.
  return { crumb: 'Admin', title: prettifySegment(pathname) };
}
