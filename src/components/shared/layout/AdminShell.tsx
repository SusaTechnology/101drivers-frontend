// components/shared/layout/AdminShell.tsx
//
// The PERSISTENT admin chrome — the thing that stops the navbar and the
// sidebar from re-rendering on every admin page change.
//
// WHY THIS EXISTS
// Every admin page used to render its own <Navbar> (which mounts the
// <AppSidebar> inside it). React therefore unmounted and remounted the
// ENTIRE shell on every navigation: ResizeObservers re-attached, the
// collapsed state was re-read, the mobile drawer's state died, and during
// every slower-than-150ms navigation the whole tree swapped to
// <RoutePending> so even the header visibly blinked.
//
// HOW IT WORKS
// The router ROOT renders <AdminShell /> ONCE, above <Outlet />. While the
// pathname stays inside the admin area the shell never unmounts — only the
// page content below it swaps, pending states included. Leaving the admin
// area (or landing on one of the bespoke-header pages) unmounts it, so
// dealer/driver/customer pages are untouched and never pay for it.
//
// The shell renders exactly what the pages used to render: the SAME
// <Navbar> with the SAME shared props (navItems / Brand / admin actions),
// so visually nothing changes — it just stops being torn down.

import { useRouterState } from '@tanstack/react-router';
import { Navbar } from './testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';

/**
 * Admin pages that carry their own bespoke header + their own AppSidebar
 * instance. On these paths the shell renders NOTHING so the page keeps
 * exactly one header and one sidebar (no doubling).
 */
const SELF_SHELL_ADMIN_PATHS = new Set([
  '/admin-settings',
  '/admin-service-districts',
  '/admin-service-area',
  '/admin-notification-policy',
]);

export function AdminShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { actionItems, signOut } = useAdminActions();

  const ownsTheChrome =
    pathname.startsWith('/admin') && !SELF_SHELL_ADMIN_PATHS.has(pathname);

  if (!ownsTheChrome) return null;

  return (
    <Navbar
      brand={<Brand />}
      items={navItems}
      actions={actionItems}
      onSignOut={signOut}
      title="Admin"
    />
  );
}
