// hooks/useAuth.ts
import { useDataMutation, setUser } from "@/lib/tanstack/dataQuery";
import { useQueryClient } from "@tanstack/react-query";

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  id: string;
  username: string;
  roles: string[];
}

interface LoginPayload {
  username: string;
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useDataMutation<LoginResponse, LoginPayload>({
    apiEndPoint: "/auth/login",
    method: "POST",
    fetchWithoutRefresh: true,
    onSuccess: (data) => {
      setUser({
        id: data.id,
        username: data.username,
        roles: data.roles,
      });

      queryClient.setQueryData(["currentUser"], {
        id: data.id,
        username: data.username,
        roles: data.roles,
      });
    },
  });
}