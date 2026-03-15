// components/Navbar.tsx
import React, { useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Menu, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileMenuDrawer } from './MobileMenuDrawer';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface ActionItem {
  key: string;
  component: ReactNode;
}

interface NavbarProps {
  brand?: ReactNode;
  items?: NavItem[];
  actions?: ActionItem[];
  onSignOut?: () => void;           // for mobile drawer
  logo?: string;                     // optional logo for drawer
  title?: string;                    // optional title for drawer
  back?: {
    to: string;
    label?: string;
  };
  className?: string;
  children?: ReactNode;
}

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setMobileMenuOpen(false);
  const toggleMenu = () => setMobileMenuOpen(prev => !prev);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md',
          className
        )}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Left section: mobile menu + brand + navigation */}
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile menu button (internal toggle) */}
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden w-11 h-11 rounded-2xl"
              onClick={toggleMenu}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {brand && <div className="flex items-center">{brand}</div>}

            {/* Desktop navigation links */}
            {items.length > 0 && (
              <nav className="hidden lg:flex items-center gap-1">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="px-3 py-2 rounded-full text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    activeProps={{ className: 'bg-slate-150 dark:bg-slate-700' }}
                  >
                    {item.icon && <span className="mr-2 inline-block">{item.icon}</span>}
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Custom children (badges, etc.) */}
          {children && <div className="hidden md:block">{children}</div>}

          {/* Right section: actions + back button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {actions.map((action) => (
              <React.Fragment key={action.key}>{action.component}</React.Fragment>
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

      {/* Mobile drawer – rendered only when open */}
      <MobileMenuDrawer
        isOpen={mobileMenuOpen}
        onClose={closeMenu}
        items={items}
        onSignOut={onSignOut}
        title={title}
        logo={logo}
      />
    </>
  );
}