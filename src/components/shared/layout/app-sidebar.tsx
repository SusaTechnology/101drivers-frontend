// components/shared/layout/app-sidebar.tsx
//
// ERP-style persistent admin sidebar — the industry-standard app-shell
// navigation (Linear / Stripe / ERPNext pattern):
//
//   • ALWAYS visible on desktop (lg+) — it never disappears when a link is
//     chosen, so navigation context never goes away mid-task.
//   • PUSHES the page instead of covering it: the sidebar is position:fixed
//     and publishes its width as the `--app-sidebar-push` CSS variable;
//     styles.css turns that into `body { padding-left }` on lg+ screens.
//     Content, sticky navbar and centered page containers all slide right in
//     sync with the sidebar's own width transition — nothing overlaps,
//     nothing reflows under the user's cursor.
//   • COLLAPSES on demand to an icon rail (titles become tooltips, the
//     Support badge becomes a dot on the icon). State persists in
//     localStorage, and Ctrl/Cmd+B toggles it (the convention every major
//     dashboard uses).
//   • MOBILE UNAFFECTED: below lg the whole component renders nothing and
//     the existing measured navbar + MobileMenuDrawer behavior is untouched.
//
// Deliberately NOT the shadcn <Sidebar> primitive: that one assumes it can
// wrap the page content in a flex grid (SidebarProvider + SidebarInset).
// Admin pages render <Navbar> themselves — 40+ call sites — so the shell
// here is self-contained and bridges to the page layout purely through CSS.

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  CalendarClock,
  Circle,
  CreditCard,
  Gavel,
  LayoutDashboard,
  LineChart,
  LifeBuoy,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings2,
  ShieldCheck,
  Tag,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

const SIDEBAR_WIDTH_EXPANDED = 240; // px — icon + label rail
const SIDEBAR_WIDTH_COLLAPSED = 68; // px — icon-only rail
const STORAGE_KEY = 'app_sidebar_collapsed';

/** Icon per destination. navItems stays plain data (same contract the
 *  measured navbar uses); the icon map lives with the only consumer that
 *  needs icons. Unmapped hrefs fall back to a neutral dot icon. */
const ITEM_ICONS: Record<string, LucideIcon> = {
  '/admin-dashboard': LayoutDashboard,
  '/admin-users': Users,
  '/admin-deliveries': Truck,
  '/admin-support-list': LifeBuoy,
  '/admin-pricing': Tag,
  '/admin-scheduling-policy': CalendarClock,
  '/admin-disputes': Gavel,
  '/admin-payments': CreditCard,
  '/admin-cms': Newspaper,
  '/admin-insurance-reporting': ShieldCheck,
  '/admin-reports': BarChart3,
  '/admin-metrics': LineChart,
  '/admin-config': Settings2,
  '/admin-audit-logs': ScrollText,
};

export interface AppSidebarItem {
  href: string;
  label: string;
  /** Live counter node (e.g. SupportNavBadge) — rendered at the app-icon
   *  position on the row; collapses to a dot on the icon. */
  badge?: React.ReactNode;
}

export function AppSidebar({ items }: { items: AppSidebarItem[] }) {
  // Active item = exact pathname match. All admin destinations are flat
  // paths (detail pages pass their id in history state, not the URL), so a
  // strict equality is both correct and version-proof — this project's
  // TanStack Router build does not accept a function className on <Link>.
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Read the persisted state synchronously so the FIRST paint already has
  // the right width (no expand-flash on navigation, which remounts us).
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* private mode — state just won't persist */
      }
      return next;
    });
  }, []);

  // Publish the push width BEFORE paint (useLayoutEffect) so navigating
  // between admin pages never shows one frame of unpadded content.
  //
  // NOTE: deliberately NO cleanup that resets the variable to 0px. This
  // component unmounts on every route change (each admin page renders
  // <Navbar> itself), INCLUDING during pending windows — every navigation
  // slower than defaultPendingMs (150ms) swaps the whole tree for
  // <RoutePending>, unmounting us mid-navigation. Resetting there made
  // body padding-left animate 240px → 0px → 240px and the entire page
  // visibly swung sideways on every such navigation (and on load, where
  // the variable only appeared after React mounted). The width VALUE now
  // survives route changes; whether the padding applies at all is decided
  // by the html[data-admin-shell] gate owned by the router root
  // (__root.tsx), which switches it off only when the user actually
  // leaves the admin area. index.html pre-seeds the same value pre-paint
  // so even the first load never renders unpadded.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      '--app-sidebar-push',
      `${collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED}px`
    );
  }, [collapsed]);

  // Ctrl/Cmd+B — the toggle shortcut every major dashboard uses.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return (
    <aside
      data-collapsed={collapsed}
      aria-label="Admin navigation"
      className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
    >
      {/* Brand row — the collapse toggle lives HERE, on the same row,
          pinned to the right end of the logo (ERP convention). When the
          rail is collapsed, the row is one button: the logo by default and
          the expand icon on hover, and clicking it EXPANDS the sidebar
          instead of navigating. */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-slate-200 dark:border-slate-800',
          collapsed ? 'justify-center px-2' : 'justify-between gap-1 pl-4 pr-2'
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={false}
            aria-label="Expand sidebar"
            title="Expand sidebar (Ctrl/Cmd+B)"
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-black transition-opacity group-hover:opacity-0 dark:border-slate-700">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="h-full w-full object-cover"
              />
            </span>
            {/* Expand icon — replaces the logo while hovered */}
            <PanelLeftOpen className="absolute h-[18px] w-[18px] text-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          <>
            <Link
              to="/admin-dashboard"
              title="101 Drivers — Admin Console"
              className="flex min-w-0 items-center gap-2.5"
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-black dark:border-slate-700">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black leading-tight text-slate-900 dark:text-white">
                  101 Drivers
                </span>
                <span className="block text-[10px] font-bold uppercase leading-tight tracking-widest text-slate-400">
                  Admin Console
                </span>
              </span>
            </Link>
            {/* Collapse — same row as the logo, right end */}
            <button
              type="button"
              onClick={toggle}
              aria-expanded
              aria-label="Collapse sidebar"
              title="Collapse sidebar (Ctrl/Cmd+B)"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </div>

      {/* Navigation — active rows get the lime accent bar on the left edge,
          matching the brand; hover states mirror the navbar. */}
      <nav className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && (
          <div className="px-2 pb-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400/80">
            Workspace
          </div>
        )}
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = ITEM_ICONS[item.href] ?? Circle;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center rounded-xl text-sm font-semibold transition-colors duration-150',
                    collapsed
                      ? 'mx-auto h-10 w-10 justify-center'
                      : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-primary/10 font-bold text-primary'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  )}
                >
                  {/* Active accent bar (expanded rail only — in the collapsed
                      rail the row highlight is enough) */}
                  {isActive && !collapsed && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                    />
                  )}
                  <span className="relative shrink-0">
                    <Icon className="h-[18px] w-[18px]" />
                    {/* Collapsed rail: the live badge becomes a dot pinned
                        to the icon (app-icon position). */}
                    {collapsed && item.badge && (
                      <span className="absolute -right-1.5 -top-1.5">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <span className="relative min-w-0 flex-1 truncate text-left">
                      {item.label}
                      {/* Expanded: badge floats at the label's top-right
                          corner — same position the navbar uses. */}
                      {item.badge && (
                        <span className="absolute -right-2 -top-2.5">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
