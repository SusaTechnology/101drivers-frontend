// hooks/useSignOut.ts
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

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
    // Here you would also clear auth tokens, etc.
    toast.success(successMessage);
    navigate({ to: redirectTo });
  };

  return signOut;
}