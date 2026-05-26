// hooks/useAuth.ts
import { useDataMutation, setUser } from "@/lib/tanstack/dataQuery";
import { useQueryClient } from "@tanstack/react-query";

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  id: string;
  username: string;
  fullName?: string | null;
  roles: string[];
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
      setUser({
        id: data.id,
        username: data.username,
        fullName: data.fullName,
        roles: data.roles,
      });

      queryClient.setQueryData(["currentUser"], {
        id: data.id,
        username: data.username,
        fullName: data.fullName,
        roles: data.roles,
      });
    },
  });
}