// hooks/useSignOut.ts
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { performSignOut } from '@/lib/tanstack/dataQuery';

interface UseSignOutOptions {
  redirectTo?: string;        // where to go after sign out
  successMessage?: string;    // optional toast message
}

export function useSignOut({
  redirectTo = '/auth/admin-signin',
  successMessage = 'Signed out successfully',
}: UseSignOutOptions = {}) {
  const navigate = useNavigate();

  const signOut = () => {
    // Full cleanup: best-effort server logout (clears the httpOnly refresh
    // cookie), stops the keep-alive interval and wipes the local session.
    performSignOut();
    toast.success(successMessage);
    navigate({ to: redirectTo });
  };

  return signOut;
}
