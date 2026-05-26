// Types for Notification Event API

// ==================== ENUMS ====================

export type NotificationEventType =
  | 'DELIVERY_STATUS_CHANGED'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_CANCELLED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'SCHEDULE_CHANGED'
  | 'COMPLIANCE_REQUEST'
  | 'COMPLIANCE_REMINDER'
  | 'SUPPORT_REQUEST_CREATED'
  | 'SUPPORT_REQUEST_UPDATED'
  | 'DISPUTE_CREATED'
  | 'DISPUTE_RESOLVED'
  | 'SYSTEM_ALERT'
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

// Type to icon mapping helper
export const NOTIFICATION_TYPE_STYLES: Record<NotificationEventType, { icon: string; color: string; label: string }> = {
  DELIVERY_STATUS_CHANGED: { icon: 'Truck', color: 'blue', label: 'Delivery Update' },
  DELIVERY_ASSIGNED: { icon: 'UserPlus', color: 'green', label: 'Assigned' },
  DELIVERY_COMPLETED: { icon: 'CheckCircle', color: 'emerald', label: 'Completed' },
  DELIVERY_CANCELLED: { icon: 'XCircle', color: 'red', label: 'Cancelled' },
  PAYMENT_RECEIVED: { icon: 'DollarSign', color: 'green', label: 'Payment' },
  PAYMENT_FAILED: { icon: 'AlertCircle', color: 'red', label: 'Payment Failed' },
  SCHEDULE_CHANGED: { icon: 'Calendar', color: 'amber', label: 'Schedule' },
  COMPLIANCE_REQUEST: { icon: 'FileCheck', color: 'amber', label: 'Compliance' },
  COMPLIANCE_REMINDER: { icon: 'AlertTriangle', color: 'amber', label: 'Reminder' },
  SUPPORT_REQUEST_CREATED: { icon: 'Headphones', color: 'blue', label: 'Support' },
  SUPPORT_REQUEST_UPDATED: { icon: 'MessageSquare', color: 'blue', label: 'Support Update' },
  DISPUTE_CREATED: { icon: 'AlertTriangle', color: 'red', label: 'Dispute' },
  DISPUTE_RESOLVED: { icon: 'CheckCircle', color: 'green', label: 'Dispute Resolved' },
  SYSTEM_ALERT: { icon: 'Bell', color: 'slate', label: 'System' },
  GENERAL: { icon: 'Info', color: 'slate', label: 'Info' },
};
