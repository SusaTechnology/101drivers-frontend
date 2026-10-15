// Types for Support Request API

// ==================== ENUMS ====================

export type SupportRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type SupportRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type SupportRequestCategory =
  | 'DELIVERY_ISSUE'
  | 'PAYMENT_ISSUE'
  | 'SCHEDULE_CHANGE'
  | 'CANCELLATION_REQUEST'
  | 'DISPUTE_HELP'
  | 'DRIVER_ISSUE'
  | 'GENERAL';

export type SupportRequestActorRole = 'DEALER' | 'PRIVATE_CUSTOMER' | 'DRIVER' | 'ADMIN';

// ==================== CATEGORY CONFIG BY ROLE ====================

export const CATEGORIES_BY_ROLE: Record<string, { value: SupportRequestCategory; label: string; description: string }[]> = {
  DEALER: [
    { value: 'DELIVERY_ISSUE', label: 'Delivery Issue', description: 'Problems with pickup, dropoff, or driver' },
    { value: 'PAYMENT_ISSUE', label: 'Payment Issue', description: 'Billing, invoicing, or payment errors' },
    { value: 'CANCELLATION_REQUEST', label: 'Cancellation Request', description: 'Request to cancel a delivery' },
    { value: 'DISPUTE_HELP', label: 'Dispute Help', description: 'Help with an ongoing dispute' },
    { value: 'GENERAL', label: 'General', description: 'Other questions or issues' },
  ],
  PRIVATE_CUSTOMER: [
    { value: 'GENERAL', label: 'General', description: 'General questions or help' },
    { value: 'DELIVERY_ISSUE', label: 'Delivery Issue', description: 'Problems with your delivery' },
    { value: 'PAYMENT_ISSUE', label: 'Payment Issue', description: 'Payment related issues' },
    { value: 'CANCELLATION_REQUEST', label: 'Cancellation Request', description: 'Request to cancel' },
  ],
  DRIVER: [
    { value: 'DELIVERY_ISSUE', label: 'Delivery Issue', description: 'Access problems, customer unavailable' },
    { value: 'SCHEDULE_CHANGE', label: 'Schedule Change', description: 'Request time window change' },
    { value: 'DRIVER_ISSUE', label: 'Driver Issue', description: 'Vehicle issue, traffic delay' },
    { value: 'GENERAL', label: 'General', description: 'Other issues' },
  ],
};

export const PRIORITY_OPTIONS: { value: SupportRequestPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'slate' },
  { value: 'NORMAL', label: 'Normal', color: 'blue' },
  { value: 'HIGH', label: 'High', color: 'amber' },
  { value: 'URGENT', label: 'Urgent', color: 'red' },
];

export const STATUS_OPTIONS: { value: SupportRequestStatus; label: string; color: string }[] = [
  { value: 'OPEN', label: 'Open', color: 'blue' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'amber' },
  { value: 'RESOLVED', label: 'Resolved', color: 'emerald' },
  { value: 'CLOSED', label: 'Closed', color: 'slate' },
];

// ==================== API REQUEST TYPES ====================

// Create Support Request
export interface CreateSupportRequestPayload {
  deliveryId?: string;
  actorRole?: SupportRequestActorRole; // Optional - backend determines from auth token
  category: SupportRequestCategory;
  priority: SupportRequestPriority;
  subject: string;
  message: string;
}

export interface CreateSupportRequestResponse {
  id: string;
  status: SupportRequestStatus;
  category: SupportRequestCategory;
  priority: SupportRequestPriority;
  subject: string;
  message: string;
  deliveryId?: string;
  createdAt: string;
}

// List Support Requests (My)
export interface SupportRequestListItem {
  id: string;
  status: SupportRequestStatus;
  category: SupportRequestCategory;
  priority: SupportRequestPriority;
  subject: string;
  deliveryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListSupportRequestsResponse {
  items: SupportRequestListItem[];
  count: number;
}

export interface ListSupportRequestsParams {
  status?: SupportRequestStatus;
  category?: SupportRequestCategory;
  priority?: SupportRequestPriority;
}

// Admin List Support Requests
export interface AdminListSupportRequestsParams {
  status?: SupportRequestStatus;
  category?: SupportRequestCategory;
  priority?: SupportRequestPriority;
  actorRole?: SupportRequestActorRole;
  assignedToUserId?: string;
  deliveryId?: string;
}

// ==================== SENDER IDENTITY ====================

// Full identity of a person in a support conversation, exactly as the
// backend's enriched select (SupportRequestDomain.SUPPORT_USER_IDENTITY_SELECT)
// sends it: account fields from the User row plus the role profile that owns
// the real contact/photo data (Driver.selfiePhotoUrl / profilePhotoUrl,
// Customer.businessName / businessPhone / contactPhone). Used for the ticket
// owner (user), the assignee (assignedTo) and every note author
// (note.authorUser) so the UI can show name + email + phone + selfie.
export interface SupportUserIdentity {
  id: string;
  username?: string;
  email?: string;
  fullName?: string | null;
  phone?: string | null;
  roles?: string[];
  driver?: {
    phone?: string | null;
    profilePhotoUrl?: string | null;
    selfiePhotoUrl?: string | null;
  } | null;
  customer?: {
    businessName?: string | null;
    businessPhone?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    phone?: string | null;
  } | null;
}

export interface ResolvedSupportIdentity {
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  businessName: string | null;
  initials: string;
}

// Resolve the display identity from the payload. Fallbacks mirror how the
// rest of the app treats these fields:
//   photo  — Driver.selfiePhotoUrl first (the onboarding selfie), then
//            Driver.profilePhotoUrl; dealers/admins have no photo field.
//   phone  — account phone, then customer (contact) phones, then driver phone.
//   name   — fullName, then username; callers supply their own last fallback.
export function resolveSupportIdentity(
  identity?: SupportUserIdentity | null
): ResolvedSupportIdentity {
  const name = identity?.fullName?.trim() || identity?.username || 'Unknown';
  const email = identity?.email?.trim() || null;
  const phone =
    identity?.phone?.trim() ||
    identity?.customer?.phone?.trim() ||
    identity?.customer?.contactPhone?.trim() ||
    identity?.customer?.businessPhone?.trim() ||
    identity?.driver?.phone?.trim() ||
    null;
  const photoUrl =
    identity?.driver?.selfiePhotoUrl ||
    identity?.driver?.profilePhotoUrl ||
    null;
  const businessName = identity?.customer?.businessName?.trim() || null;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

  return { name, email, phone, photoUrl, businessName, initials };
}

// Support Request Detail
// NOTE: the backend sends the author's identity as `authorUser` (enriched
// select in SupportRequestDomain) — there has never been an `authorName`
// field; the old FE type/read of authorName was why sender names never
// rendered (issue: "dealer doesn't see who is sending").
export interface SupportRequestNote {
  id: string;
  authorRole: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  authorUserId?: string | null;
  authorUser?: SupportUserIdentity | null;
}

export interface SupportRequestDetail {
  id: string;
  status: SupportRequestStatus;
  category: SupportRequestCategory;
  priority: SupportRequestPriority;
  subject: string;
  message: string;
  deliveryId?: string;
  actorRole: SupportRequestActorRole;
  assignedToUserId?: string;
  // The ticket owner — full identity (name/email/phone/selfie) so the
  // viewer can see WHO raised the request and how to reach them.
  user?: SupportUserIdentity | null;
  // The backend relation is `assignedTo` (enriched select). The old
  // `assignedToUser` key never existed in the payload.
  assignedTo?: SupportUserIdentity | null;
  delivery?: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    status: string;
  };
  notes: SupportRequestNote[];
  createdAt: string;
  updatedAt: string;
}

// Reply to Support Request
export interface ReplySupportRequestPayload {
  message: string;
}

export interface ReplySupportRequestResponse {
  id: string;
  message: string;
  createdAt: string;
}

// Add Internal Note (Admin only)
export interface AddInternalNotePayload {
  message: string;
}

export interface AddInternalNoteResponse {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

// Assign Support Request (Admin only)
export interface AssignSupportRequestPayload {
  assignedToUserId: string;
}

export interface AssignSupportRequestResponse {
  id: string;
  assignedToUserId: string;
  updatedAt: string;
}

// Change Status (Admin only)
export interface ChangeSupportStatusPayload {
  status: SupportRequestStatus;
}

export interface ChangeSupportStatusResponse {
  id: string;
  status: SupportRequestStatus;
  updatedAt: string;
}
