// components/layout/MobileMenuDrawer.tsx
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, LogOut } from 'lucide-react';
import type { NavItem } from './testNavbar'; // adjust path as needed

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
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 z-50 md:hidden overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200">
              <img src={logo} alt={title} className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{title}</span>
          </div>
          <Button variant="outline" size="icon" className="w-10 h-10 rounded-2xl" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "block px-4 py-3 rounded-2xl text-sm font-semibold transition-colors",
                // active state – you might want to use useMatch for more accuracy
                location.pathname === item.href
                  ? "bg-primary/15 text-slate-900 dark:text-white border border-primary/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Separator className="my-6" />

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
    </>
  );
}