// hooks/useAuth.ts
import { useDataMutation, setUser } from "@/lib/tanstack/dataQuery";
import { useQueryClient } from "@tanstack/react-query";

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  id: string;
  profileId?: string | null;
  username: string;
  email?: string | null;
  fullName?: string | null;
  roles: string[];
  customerApprovalStatus?: string | null;
  driverStatus?: string | null;
  onboardingCompleted?: boolean;
  onboardingToken?: string | null;
  isActive?: boolean;
  // Elevated-admin flag (ADMIN rows only) — must be stored or the
  // super-admin UI gates stay false for real super admins.
  isSuperAdmin?: boolean;
}

interface LoginPayload {
  username: string;
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useDataMutation<LoginResponse, LoginPayload>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/login`,
    method: "POST",
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data) => {
      // Store the FULL login payload (minus tokens). Hand-picking fields
      // silently dropped newer ones like isSuperAdmin — the super-admin
      // gates stayed false even for real super admins until they
      // happened to land on a page that re-derives the flag.
      const { accessToken: _accessToken, refreshToken: _refreshToken, ...user } = data;
      setUser(user);
      queryClient.setQueryData(["currentUser"], user);
    },
  });
}