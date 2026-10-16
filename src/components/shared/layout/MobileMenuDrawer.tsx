// components/shared/layout/MobileMenuDrawer.tsx
//
// Slide-in navigation drawer for the admin navbar (testNavbar). Opens
// whenever the horizontal nav does not fit — phone, tablet, laptop or a
// wide screen with too many nav items — so it must NOT be gated behind a
// fixed breakpoint class (the old version was hard-coded `xl:hidden`,
// which would have broken it on exactly the wide-but-crowded screens the
// measured collapse exists for).
//
// Built on the shadcn Sheet (Radix Dialog): focus trap, Escape-to-close,
// overlay-click close, body scroll lock and slide animations come for
// free and are easy to get subtly wrong by hand.

import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LogOut } from 'lucide-react';
import type { NavItem } from './testNavbar';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  onSignOut: () => void;
  title?: string;
  logo?: string;
}

export function MobileMenuDrawer({
  isOpen,
  onClose,
  items,
  onSignOut,
  title = 'Admin',
  logo = '/assets/101drivers-logo.jpg',
}: MobileMenuDrawerProps) {
  const location = useLocation();

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="left"
        className="w-[300px] max-w-[85vw] p-0 bg-white dark:bg-slate-900"
      >
        <SheetHeader className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-700 shrink-0">
              <img
                src={logo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <SheetTitle className="text-sm font-extrabold text-slate-900 dark:text-white">
              {title}
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Admin navigation menu
          </SheetDescription>
        </SheetHeader>

        <Separator className="mt-0" />

        <nav
          aria-label="Admin sections"
          className="flex-1 overflow-y-auto p-4 space-y-1"
        >
          {items.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors',
                  active
                    ? 'bg-primary/15 text-primary border border-primary/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                {/* Same badge treatment as the horizontal bar: the counter
                    sits at the label's TOP-RIGHT corner, nearly touching the
                    text — not a separate word floating at the row edge. */}
                <span className="relative inline-block">
                  {item.label}
                  {item.badge && (
                    <span className="absolute -top-2.5 -right-2.5">
                      {item.badge}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Sign Out
            <LogOut className="w-4 h-4 text-primary" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
