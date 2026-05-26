// lib/navbar/adminActionItems.ts
import { ThemeToggle } from "@/lib/theme/themeToggle";
import { MobileMenuButton } from "./actions/MobileMenuButton";
import { SignOutAction } from "./actions/SignOutAction";
import { AdminBadge } from "./badges/AdminBadge";
import NotificationBell from "@/components/notifications/NotificationBell";

interface AdminActionHandlers {
  onSignOut: () => void;
  onMobileMenuOpen: () => void;
}

export const getAdminActionItems = ({
  onSignOut,
  onMobileMenuOpen,
}: AdminActionHandlers) => [
    {
        key: 'badge',
        component: <AdminBadge />
    },
  {
    key: 'notifications',
    component: <NotificationBell />,
  },
  {
    key: 'theme',
    component: <ThemeToggle />,
  },
  {
    key: 'signout',
    component: <SignOutAction onSignOut={onSignOut} />,
  },
  {
    key: 'mobile-menu',
    component: <MobileMenuButton onOpen={onMobileMenuOpen} />,
  },
];


