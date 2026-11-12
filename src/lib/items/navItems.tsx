// navItems.tsx — admin top-nav destinations.
//
// `badge: 'support'` marks the item whose label carries a live unread
// counter (rendered by testNavbar / MobileMenuDrawer). The badge component
// (SupportNavBadge) self-fetches and self-subscribes to the staff-ops
// socket room — navItems stays plain data.

import { SupportNavBadge } from '@/lib/items/badges/SupportNavBadge';
import type { ReactNode } from 'react';

export interface AdminNavItem {
  href: string;
  label: string;
  active?: boolean;
  badge?: ReactNode;
}

export const navItems: AdminNavItem[] = [
  { href: '/admin-dashboard', label: 'Dashboard', active: true },
  { href: '/admin-metrics', label: 'Metrics' },
  { href: '/admin-users', label: 'Users' },
  { href: '/admin-deliveries', label: 'Deliveries' },
  {
    href: '/admin-support-list',
    label: 'Support',
    // Live unread counter — bumps on `support:staff-inbox` socket pings
    // (new ticket / customer reply), clears when an admin opens the ticket.
    badge: <SupportNavBadge />,
  },
  { href: '/admin-pricing', label: 'Pricing' },
  { href: '/admin-scheduling-policy', label: 'Scheduling' },
  { href: '/admin-disputes', label: 'Disputes' },
  { href: '/admin-payments', label: 'Payments' },
  { href: '/admin-cms', label: 'Content' },
  // Billing Health deliberately NOT in the navbar — the admin nav is
  // already overcrowded (items start collapsing). The page stays
  // reachable from the Payments page header button + the failed-payments
  // callout + the payment-detail failure panel, which is where the
  // question "who needs payment help" actually comes up.
  { href: '/admin-insurance-reporting', label: 'Insurance' },
  { href: '/admin-reports', label: 'Reports' },
  { href: '/admin-config', label: 'Config' },
  { href: '/admin-audit-logs', label: 'Audit Logs' },
] as AdminNavItem[];
