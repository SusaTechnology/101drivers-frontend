// lib/navbar/adminActionItems.ts
import { ThemeToggle } from "@/lib/theme/themeToggle";
import { MobileMenuButton } from "./actions/MobileMenuButton";
import { SignOutAction } from "./actions/SignOutAction";
import { AdminBadge } from "./badges/AdminBadge";

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


