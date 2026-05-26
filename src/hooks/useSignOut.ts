// hooks/useSignOut.ts
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { clearAuth, getAccessToken, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery';

interface UseSignOutOptions {
  redirectTo?: string;        // where to go after sign out
  successMessage?: string;    // optional toast message
}

export function useSignOut({
  redirectTo = '/auth/admin-signin',
  successMessage = 'Signed out successfully',
}: UseSignOutOptions = {}) {
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      // Call backend logout endpoint to clear refresh token cookie
      const token = getAccessToken();
      if (token) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        }).catch(() => {
          // Ignore errors - still clear local auth
        });
      }
    } catch (error) {
      // Ignore errors - still clear local auth
    } finally {
      // Stop session keep-alive
      stopSessionKeepAlive();
      // Clear all auth data from localStorage
      clearAuth();
      toast.success(successMessage);
      navigate({ to: redirectTo });
    }
  };

  return signOut;
}