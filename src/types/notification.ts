// Types for Notification Event API
//
// NOTE: These now mirror the backend `EnumNotificationEventType` enum in
// prisma/schema.prisma exactly. If the backend enum changes, update this too.
// The previously-declared types (DELIVERY_COMPLETED, PAYMENT_RECEIVED, etc.)
// did not exist on the backend, so notifications of those types never
// rendered correctly in the bell.

// ==================== ENUMS ====================

export type NotificationEventType =
  // Signup / approval
  | 'USER_SIGNUP'
  | 'DEALER_SIGNUP'
  | 'DRIVER_SIGNUP'
  | 'DEALER_APPROVED'
  | 'DRIVER_APPROVED'
  // Delivery lifecycle
  | 'DELIVERY_STATUS_CHANGED'
  | 'DELIVERY_BOOKED'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_REASSIGNED'
  | 'DELIVERY_CANCELLED'
  // Tracking
  | 'TRACKING_STARTED'
  | 'TRACKING_STOPPED'
  // Payment
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED'
  // Disputes
  | 'DISPUTE_OPENED'
  | 'DISPUTE_UPDATED'
  // Scheduling
  | 'SCHEDULE_CHANGE_REQUESTED'
  | 'SCHEDULE_CHANGE_DECIDED'
  // Support
  | 'SUPPORT_REQUEST_CREATED'
  | 'SUPPORT_REQUEST_ASSIGNED'
  | 'SUPPORT_REQUEST_REPLIED'
  | 'SUPPORT_REQUEST_RESOLVED'
  | 'SUPPORT_REQUEST_CLOSED'
  // Misc
  | 'REMINDER'
  // Legacy fallback (for older notification rows that may predate the enum expansion)
  | 'GENERAL';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH';

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

// ==================== API RESPONSE TYPES ====================

// Notification item in inbox list
export interface NotificationEventItem {
  id: string;
  type: NotificationEventType;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  body: string;
  templateCode?: string;
  toEmail?: string;
  toPhone?: string;
  payload?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  failedAt?: string;
  errorMessage?: string;
  isRead: boolean;
  seenInListAt?: string;
  openedAt?: string;
  readAt?: string;
  clickedAt?: string;
  archivedAt?: string;
  dismissedAt?: string;
  expiresAt?: string;
  delivery?: {
    id: string;
    status: string;
  };
}

// Inbox response
export interface NotificationInboxResponse {
  items: NotificationEventItem[];
  count: number;
  unreadCount: number;
}

// Query params for inbox
export interface NotificationInboxParams {
  unreadOnly?: boolean;
  includeArchived?: boolean;
  take?: number;
  skip?: number;
}

// Open notification response
export interface OpenNotificationPayload {
  markRead?: boolean;
}

export interface OpenNotificationResponse {
  id: string;
  openedAt: string;
  isRead: boolean;
  readAt?: string;
}

// Mark read/unread
export interface MarkReadPayload {
  read: boolean;
}

export interface MarkReadResponse {
  id: string;
  isRead: boolean;
  readAt?: string;
}

// Mark all as read
export interface MarkAllReadResponse {
  updatedCount: number;
}

// Archive notification
export interface ArchiveNotificationPayload {
  archived: boolean;
}

export interface ArchiveNotificationResponse {
  id: string;
  archivedAt?: string;
}

// Track click
export interface TrackClickPayload {
  targetUrl: string;
}

export interface TrackClickResponse {
  id: string;
  clickedAt: string;
}

// ==================== HELPER TYPES ====================

// Type to icon mapping helper. Covers every backend `EnumNotificationEventType`
// value. Lock-in variants are detected via `templateCode` (see
// `getNotificationStyle` below) so e.g. a `DELIVERY_CANCELLED` notification
// for a lock-in cancel renders with a "lock" badge instead of a generic
// red "Cancelled" badge.
export const NOTIFICATION_TYPE_STYLES: Record<NotificationEventType, { icon: string; color: string; label: string }> = {
  // Signup / approval
  USER_SIGNUP: { icon: 'UserPlus', color: 'blue', label: 'New User' },
  DEALER_SIGNUP: { icon: 'Store', color: 'blue', label: 'New Dealer' },
  DRIVER_SIGNUP: { icon: 'Car', color: 'blue', label: 'New Driver' },
  DEALER_APPROVED: { icon: 'CheckCircle', color: 'emerald', label: 'Dealer Approved' },
  DRIVER_APPROVED: { icon: 'CheckCircle', color: 'emerald', label: 'Driver Approved' },

  // Delivery lifecycle
  DELIVERY_STATUS_CHANGED: { icon: 'Truck', color: 'blue', label: 'Delivery Update' },
  DELIVERY_BOOKED: { icon: 'CalendarCheck', color: 'indigo', label: 'Booked' },
  DELIVERY_ASSIGNED: { icon: 'UserPlus', color: 'green', label: 'Assigned' },
  DELIVERY_REASSIGNED: { icon: 'RefreshCw', color: 'amber', label: 'Reassigned' },
  DELIVERY_CANCELLED: { icon: 'XCircle', color: 'red', label: 'Cancelled' },

  // Tracking
  TRACKING_STARTED: { icon: 'MapPin', color: 'blue', label: 'Tracking Started' },
  TRACKING_STOPPED: { icon: 'MapPinOff', color: 'slate', label: 'Tracking Stopped' },

  // Payment
  PAYMENT_AUTHORIZED: { icon: 'CreditCard', color: 'amber', label: 'Payment Authorized' },
  PAYMENT_CAPTURED: { icon: 'DollarSign', color: 'green', label: 'Payment Captured' },
  PAYMENT_FAILED: { icon: 'AlertCircle', color: 'red', label: 'Payment Failed' },

  // Disputes
  DISPUTE_OPENED: { icon: 'AlertTriangle', color: 'red', label: 'Dispute Opened' },
  DISPUTE_UPDATED: { icon: 'AlertTriangle', color: 'amber', label: 'Dispute Updated' },

  // Scheduling
  SCHEDULE_CHANGE_REQUESTED: { icon: 'CalendarClock', color: 'amber', label: 'Schedule Request' },
  SCHEDULE_CHANGE_DECIDED: { icon: 'CalendarCheck', color: 'blue', label: 'Schedule Decision' },

  // Support
  SUPPORT_REQUEST_CREATED: { icon: 'Headphones', color: 'blue', label: 'Support' },
  SUPPORT_REQUEST_ASSIGNED: { icon: 'UserCheck', color: 'blue', label: 'Support Assigned' },
  SUPPORT_REQUEST_REPLIED: { icon: 'MessageSquare', color: 'blue', label: 'Support Reply' },
  SUPPORT_REQUEST_RESOLVED: { icon: 'CheckCircle', color: 'emerald', label: 'Support Resolved' },
  SUPPORT_REQUEST_CLOSED: { icon: 'XCircle', color: 'slate', label: 'Support Closed' },

  // Misc
  REMINDER: { icon: 'Bell', color: 'amber', label: 'Reminder' },
  GENERAL: { icon: 'Info', color: 'slate', label: 'Info' },
};

/**
 * Lock-in-specific template codes that should override the default type style.
 * When a notification's `templateCode` matches one of these, the bell shows a
 * distinctive lock/LockIcon badge so users can immediately spot lock-in-related
 * events among other DELIVERY_CANCELLED / PAYMENT_CAPTURED rows.
 */
export const LOCK_IN_TEMPLATE_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  // Customer-facing
  'lock-in-captured-customer': { icon: 'Lock', color: 'amber', label: 'Base Fee Charged' },
  'delivery-cancelled-lock-in-customer': { icon: 'Lock', color: 'red', label: 'Cancelled — Base Fee Charged' },
  'delivery-cancelled-lock-in-driver': { icon: 'Lock', color: 'emerald', label: 'Lock-in Payout Secured' },
  'delivery-force-cancelled-lock-in-customer': { icon: 'Lock', color: 'red', label: 'Force-cancelled — Base Fee Charged' },
  'delivery-force-cancelled-lock-in-driver': { icon: 'Lock', color: 'emerald', label: 'Lock-in Payout Secured (force-cancel)' },

  // Admin-facing
  'admin-lock-in-retained-confirmation': { icon: 'ShieldCheck', color: 'indigo', label: 'Lock-in Retained' },
  'admin-cancel-confirmation': { icon: 'ShieldCheck', color: 'slate', label: 'Cancel Confirmation' },
};

/**
 * Resolve the effective style for a notification, preferring lock-in-specific
 * styling via `templateCode` and falling back to the default `type` style.
 * Falls back to GENERAL if the type is unknown.
 */
export function getNotificationStyle(notification: {
  type: string;
  templateCode?: string | null;
}): { icon: string; color: string; label: string } {
  if (notification.templateCode && LOCK_IN_TEMPLATE_STYLES[notification.templateCode]) {
    return LOCK_IN_TEMPLATE_STYLES[notification.templateCode];
  }
  return (
    NOTIFICATION_TYPE_STYLES[notification.type as NotificationEventType] ??
    NOTIFICATION_TYPE_STYLES.GENERAL
  );
}
