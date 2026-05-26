// hooks/useAdminActions.ts
import { useSignOut } from './useSignOut';
import { ThemeToggle } from "@/lib/theme/themeToggle";
import { SignOutAction } from '@/lib/items/actions/SignOutAction';
import { getAdminActionItems } from '@/lib/items/adminActionItems';
import { useMobileMenu } from './useMobileMenu';


export function useAdminActions() {
    const { isOpen: mobileMenuOpen, open: openMobileMenu, close: closeMobileMenu } = useMobileMenu();
    
  const signOut = useSignOut({ redirectTo: '/auth/admin-signin' });

   const actionItems = getAdminActionItems({
    onSignOut: signOut,
    onMobileMenuOpen: openMobileMenu,
  });

  return { actionItems, signOut };
}
