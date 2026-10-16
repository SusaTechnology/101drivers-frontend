// components/lib/items/badges/SupportNavBadge.tsx
//
// Live unread counter for the admin navbar "Support" item.
//
// Self-contained (same pattern as NotificationBell): it fetches the staff
// unread count from GET /api/supportRequests/admin/unread-count, keeps the
// admin-only `staff:ops` socket room joined for as long as the navbar is
// mounted, and refetches whenever the backend pings `support:staff-inbox`
// (new ticket, customer/dealer/driver reply, another admin's read receipt).
// Renders nothing while the count is 0 — the navbar item stays a plain link
// until a customer actually needs attention.
//
// The unread definition lives server-side: a ticket counts while the latest
// non-admin note (the original message is also a note) is newer than the
// staff read receipt (SupportRequest.adminReadAt, set by
// POST /supportRequests/:id/mark-admin-read when an admin opens the ticket).
// Resolved/closed tickets never count.

import { useEffect } from 'react';
import { useDataQuery } from '@/lib/tanstack/dataQuery';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  socketJoinStaffOps,
  socketLeaveStaffOps,
} from '@/lib/socket';
import { cn } from '@/lib/utils';
import { getUser } from '@/lib/tanstack/dataQuery';

interface UnreadCountResponse {
  unreadCount: number;
}

export function SupportNavBadge({ className }: { className?: string }) {
  const user = getUser();
  const isAdmin = !!user?.roles?.includes('ADMIN');

  const { data, refetch } = useDataQuery<UnreadCountResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/admin/unread-count`,
    noFilter: true,
    staleTime: 30 * 1000,
    queryKey: ['admin-support-unread-count'],
    enabled: isAdmin,
  });

  // Keep the ops staff room joined for the navbar's lifetime. Reference-
  // counted in socket.ts — the support list page also joins/leaves on
  // navigation, and the room must stay alive while the badge is mounted.
  useEffect(() => {
    if (!isAdmin) return;
    socketJoinStaffOps();
    return () => {
      socketLeaveStaffOps();
    };
  }, [isAdmin]);

  // Contentless pings: new ticket / non-admin reply (badge up), or another
  // admin's read receipt (badge down). The backend is the source of truth —
  // we just refetch the count.
  useSocketEvent<{ supportRequestId: string }>('support:staff-inbox', () => {
    if (isAdmin) refetch();
  });

  // Non-admins (and failures) render nothing at all.
  if (!isAdmin) return null;

  const unreadCount = data?.unreadCount ?? 0;
  if (unreadCount <= 0) return null;

  return (
    <span
      data-testid="support-unread-badge"
      className={cn(
        'inline-flex min-w-[18px] max-w-[34px] items-center justify-center rounded-full bg-red-500 px-1.5 py-px text-[10px] font-bold leading-[14px] text-white',
        className
      )}
      title={`${unreadCount} support ${unreadCount === 1 ? 'request needs' : 'requests need'} attention`}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}
