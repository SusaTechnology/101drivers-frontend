export const navItems = [
  { href: '/admin-dashboard', label: 'Dashboard', active: true },
  { href: '/admin-users', label: 'Users' },
  { href: '/admin-deliveries', label: 'Deliveries' },
  { href: '/admin-support-list', label: 'Support' },
  { href: '/admin-pricing', label: 'Pricing' },
  { href: '/admin-scheduling-policy', label: 'Scheduling' },
  { href: '/admin-disputes', label: 'Disputes' },
  { href: '/admin-payments', label: 'Payments' },
  // Billing Health deliberately NOT in the navbar — the admin nav is
  // already overcrowded (items start collapsing). The page stays
  // reachable from the Payments page header button + the failed-payments
  // callout + the payment-detail failure panel, which is where the
  // question "who needs payment help" actually comes up.
  { href: '/admin-insurance-reporting', label: 'Insurance' },
  { href: '/admin-reports', label: 'Reports' },
  { href: '/admin-config', label: 'Config' },
  { href: '/admin-audit-logs', label: 'Audit Logs' },
]