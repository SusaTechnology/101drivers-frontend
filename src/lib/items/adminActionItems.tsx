// lib/items/adminActionItems.tsx
import { ThemeToggle } from "@/lib/theme/themeToggle";
import { SignOutAction } from "./actions/SignOutAction";
import { AdminBadge } from "./badges/AdminBadge";
import NotificationBell from "@/components/notifications/NotificationBell";

interface AdminActionHandlers {
  onSignOut: () => void;
  /**
   * Deprecated — accepted for backward compatibility (one page still passes
   * it) and deliberately IGNORED. The mobile hamburger used to live here as
   * an action item, but the state it toggled was never rendered anywhere,
   * so the button did nothing except lock body scroll via useMobileMenu's
   * side effect. The navbar (testNavbar) now owns its own hamburger +
   * drawer, shown whenever the horizontal nav does not fit.
   */
  onMobileMenuOpen?: () => void;
}

export const getAdminActionItems = ({
  onSignOut,
}: AdminActionHandlers) => [
    {
        key: 'badge',
        component: <AdminBadge />
    },
  {
    key: 'notifications',
    component: <NotificationBell userType="admin" />,
  },
  {
    key: 'theme',
    component: <ThemeToggle />,
  },
  {
    key: 'signout',
    component: <SignOutAction onSignOut={onSignOut} />,
  },
];
