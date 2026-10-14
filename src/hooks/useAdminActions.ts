// hooks/useAdminActions.ts
import { useSignOut } from './useSignOut';
import { getAdminActionItems } from '@/lib/items/adminActionItems';

export function useAdminActions() {
  const signOut = useSignOut({ redirectTo: '/auth/admin-signin' });

  const actionItems = getAdminActionItems({
    onSignOut: signOut,
  });

  return { actionItems, signOut };
}
