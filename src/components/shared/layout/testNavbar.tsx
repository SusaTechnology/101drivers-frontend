// components/shared/layout/testNavbar.tsx
//
// Admin top navigation bar — rendered on every admin page (37 consumers).
//
// Responsive strategy — MEASURED, not guessed:
// The horizontal nav is shown only while it physically fits in the row.
// A ResizeObserver compares the nav's natural width (scrollWidth of the
// w-max content) against the space actually available (the flex-1 slot
// around it). The moment it no longer fits — a page gets added to
// navItems, the window shrinks, a badge grows, fonts load wider — the bar
// collapses to a hamburger and every destination moves into the drawer.
//
// Why measured instead of a fixed breakpoint (e.g. "collapse below 1400px"):
// the nav row's real width depends on brand size, the badge/bell/theme/
// sign-out cluster, per-item label lengths and the loaded font — any fixed
// number eventually produces a dead zone where the last items (Config,
// Audit Logs) silently clip away behind the actions cluster, which is
// exactly the bug this replaces. With measurement, adding nav entries in
// the future can never break the bar again.
//
// No-oscillation guarantee: the hamburger only exists while collapsed, and
// the nav is measured out-of-flow (absolute + invisible, still mounted) so
// expansion requires fitting in the STRICTER slot (the one that also holds
// the hamburger). A bar that collapsed for lacking space can never measure
// as "fitting" in that stricter slot, so it cannot flap back and forth.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Menu, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackAdminPath, previousAdminPath } from '@/lib/navHistory';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import { AppSidebar } from './app-sidebar';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  /** Optional live counter rendered after the label (e.g. Support unread). */
  badge?: ReactNode;
}

export interface ActionItem {
  key: string;
  component: ReactNode;
}

interface NavbarProps {
  brand?: ReactNode;
  items?: NavItem[];
  actions?: ActionItem[];
  onSignOut?: () => void; // for the drawer
  logo?: string; // optional logo for the drawer
  title?: string; // optional title for the drawer
  back?: {
    to: string;
    label?: string;
  };
  className?: string;
  children?: ReactNode;
}

const NAV_LINK_BASE =
  'px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors';
const NAV_LINK_IDLE =
  'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
// activeProps REPLACES className when active, so the full base set is
// repeated here. (The previous version repeated only a color class —
// bg-slate-150, which does not exist in Tailwind — so the active link lost
// its padding, rounding AND its highlight.)
const NAV_LINK_ACTIVE =
  'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold';

export function Navbar({
  brand,
  items = [],
  actions = [],
  onSignOut,
  logo = '/assets/101drivers-logo.jpg',
  title = 'Admin',
  back,
  className,
  children,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ── Global Back button — "take me to the page I came from" ──────────
  // Every admin page renders this Navbar, so tracking the route here
  // covers the whole admin surface with zero per-page wiring.
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    trackAdminPath(pathname);
  }, [pathname]);

  const prevPath = previousAdminPath(pathname);
  // In-app memory first; the browser session history is the fallback
  // (covers a reload that wiped the in-app stack).
  const canGoBack =
    prevPath !== null ||
    (typeof window !== 'undefined' && window.history.length > 1);

  const handleBack = useCallback(() => {
    const prev = previousAdminPath(pathname);
    if (prev) {
      router.history.push(prev); // in-app: exactly the page before this one
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back(); // reload case: the browser remembers
      return;
    }
    router.history.push('/admin-dashboard'); // last resort: admin home
  }, [pathname, router]);

  const navSlotRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const measure = useCallback(() => {
    const slot = navSlotRef.current;
    const nav = navRef.current;
    if (!slot || !nav || items.length === 0) {
      setCollapsed(false);
      return;
    }
    // +1px guards against sub-pixel rounding false positives.
    const overflows = nav.scrollWidth > slot.clientWidth + 1;
    setCollapsed((prev) => {
      // Expanding kills the hamburger; an open drawer would then be
      // unreachable, so close it on the collapse -> expand transition.
      if (prev && !overflows) setMenuOpen(false);
      return overflows;
    });
  }, [items.length]);

  // Measure before first paint so a too-wide bar never flashes.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Re-measure on every geometry change. The slot tracks the space the
  // actions/badges cluster leaves behind (window resize, badge growth);
  // the nav tracks its own content (label changes, font swap, icon load).
  useEffect(() => {
    const slot = navSlotRef.current;
    const nav = navRef.current;
    if (!slot || !nav) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(slot);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const showInlineNav = items.length > 0 && !collapsed;

  return (
    <>
      {/* ERP-style persistent sidebar — desktop (lg+) only. It shows the
          SAME navItems the measured bar does, never hides on navigation,
          and pushes the page via the --app-sidebar-push CSS variable
          (styles.css turns it into body padding). Below lg it renders
          nothing and the classic measured-bar + drawer behavior applies. */}
      <AppSidebar items={items} />

      <header
        className={cn(
          'sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md',
          className
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between gap-3 sm:gap-4">
          {/* Left section: hamburger + brand + measured nav slot.
              Hamburger + slot are MOBILE/TABLET-ONLY (lg:hidden): on desktop
              the AppSidebar owns navigation, so the top bar keeps just the
              brand + actions — the ERP shell layout. */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Global back — EVERY admin page, all breakpoints. Goes to the
                page the user actually came from (in-app route memory,
                browser history as fallback). */}
            <Button
              variant="outline"
              size="icon"
              className="w-11 h-11 rounded-2xl shrink-0"
              onClick={handleBack}
              disabled={!canGoBack}
              aria-label="Go back to the previous page"
              title={prevPath ? `Back to ${prevPath}` : 'Back'}
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </Button>

            {/* Hamburger — rendered only while the nav does not fit */}
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'w-11 h-11 rounded-2xl shrink-0 lg:hidden',
                collapsed ? 'inline-flex' : 'hidden'
              )}
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {brand && <div className="flex items-center shrink-0">{brand}</div>}

            {/* The slot IS the available space: flex-1 min-w-0. The nav
                keeps its natural width (w-max) inside so overflow is
                detectable. When collapsed it stays mounted but invisible
                and out of flow — still measurable, never focusable
                (visibility:hidden removes it from the tab order), and
                clipped by the slot so it can never cause page-level
                horizontal scroll. */}
            <div
              ref={navSlotRef}
              className="relative flex-1 min-w-0 self-stretch overflow-hidden lg:hidden"
            >
              <nav
                ref={navRef}
                aria-label="Admin sections"
                className={cn(
                  'flex h-full w-max items-center gap-1',
                  collapsed &&
                    'absolute left-0 top-1/2 -translate-y-1/2 invisible pointer-events-none'
                )}
              >
                {items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(NAV_LINK_BASE, NAV_LINK_IDLE)}
                    activeProps={{
                      className: cn(NAV_LINK_BASE, NAV_LINK_ACTIVE),
                    }}
                  >
                    {item.icon && (
                      <span className="mr-2 inline-block">{item.icon}</span>
                    )}
                    {/* The label is a positioned anchor: the live counter
                        (e.g. Support unread) floats at its TOP-RIGHT corner,
                        nearly touching the last letter — the app-icon badge
                        position, NOT a second word inline after the label.
                        The link's own px-3 padding is the badge's overflow
                        room, so text never shifts when the badge appears.
                        It still lives inside the measured link, so the
                        collapse observer re-fits the bar when it pops. */}
                    <span className="relative inline-block">
                      {item.label}
                      {item.badge && (
                        <span className="absolute -top-2.5 -right-2">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {/* Custom children (badges, etc.) */}
          {children && (
            <div className="hidden md:block shrink-0">{children}</div>
          )}

          {/* Right section: actions + back button */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {actions.map((action) => (
              <React.Fragment key={action.key}>
                {action.component}
              </React.Fragment>
            ))}

            {back && (
              <Link
                to={back.to}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-extrabold text-slate-700 dark:text-slate-200"
              >
                <ChevronLeft className="w-4 h-4 text-primary" />
                {back.label || 'Back'}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Drawer — opened only by the hamburger, which only exists while the
          bar is collapsed, so it must work at ANY viewport width (no fixed
          hidden-at-breakpoint classes here). */}
      <MobileMenuDrawer
        isOpen={menuOpen}
        onClose={closeMenu}
        items={items}
        onSignOut={onSignOut}
        title={title}
        logo={logo}
      />
    </>
  );
}
