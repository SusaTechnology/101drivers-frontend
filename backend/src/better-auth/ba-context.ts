// Shared builder for the driver-context payload — the EXACT legacy UserInfo
// shape the frontend caches in localStorage (see src/lib/tanstack/dataQuery.ts
// getUser()) plus the authSystem marker. Better Auth users get this once via
// GET /api/auth/ba/driver-context; DriverRouteGuard/dataQuery then work
// unchanged.

export interface DriverContextUserRow {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  roles: string; // EnumUserRoles scalar on the User row
  isSuperAdmin: boolean;
}

export interface DriverContextDriverRow {
  id: string;
  status: string;
  onboardingCompletedAt: Date | null;
  onboardingToken: string | null;
}

export interface DriverContextPayload {
  id: string;
  profileId: string | null;
  username: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  driverStatus: string | null;
  onboardingCompleted: boolean;
  onboardingToken: string | null;
  isSuperAdmin: boolean;
  /** Marks this session as Better-Auth-managed (FE skips legacy JWT refresh). */
  authSystem: "better-auth";
}

export function buildDriverContextPayload(
  user: DriverContextUserRow,
  driver: DriverContextDriverRow | null
): DriverContextPayload {
  return {
    id: user.id,
    profileId: driver?.id ?? null,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    roles: [String(user.roles)],
    driverStatus: driver?.status ?? null,
    onboardingCompleted: !!driver?.onboardingCompletedAt,
    onboardingToken: driver?.onboardingToken ?? null,
    isSuperAdmin: user.isSuperAdmin === true,
    authSystem: "better-auth",
  };
}
