// Shared admin lifecycle-status helper.
//
// The backend computes `adminStatus` (ACTIVE / PENDING_INVITE /
// INVITE_EXPIRED / DISABLED) for ADMIN rows — it knows whether the invite
// token is still live, which the client cannot derive from
// emailVerifiedAt alone. This helper prefers that server value and falls
// back to a client-side approximation when the field is missing (e.g. a
// cached response from before the backend deployed): unverified admins
// optimistically read as "Pending invite".
import type { AdminInviteStatus } from '@/types/users';

type AdminStatusSource = {
  adminStatus?: AdminInviteStatus | null;
  disabledAt?: string | null;
  emailVerifiedAt?: string | null;
};

export function effectiveAdminStatus(
  user: AdminStatusSource
): AdminInviteStatus {
  if (user.adminStatus) return user.adminStatus;
  if (user.disabledAt) return 'DISABLED';
  if (user.emailVerifiedAt) return 'ACTIVE';
  return 'PENDING_INVITE';
}
