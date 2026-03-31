// Types for Admin Users API
// Based on updated backend structure

// ==================== ENUMS ====================

export type UserRole = 'PRIVATE_CUSTOMER' | 'BUSINESS_CUSTOMER' | 'DRIVER' | 'ADMIN';

export type CustomerType = 'BUSINESS' | 'PRIVATE';

export type CustomerApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DriverStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';

// ==================== ADMIN USERS TABLE TYPES ====================

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  roles: UserRole;
  isActive: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: AdminCustomerEmbed | null;
  driver: AdminDriverEmbed | null;
  _count: {
    deliveriesCreated: number;
    adminActions: number;
    notifEvents: number;
    scheduleChangesRequested: number;
    scheduleChangesDecided: number;
  };
}

export interface AdminCustomerEmbed {
  id: string;
  customerType: CustomerType;
  approvalStatus: CustomerApprovalStatus;
  businessName: string | null;
  postpaidEnabled: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDriverEmbed {
  id: string;
  status: DriverStatus;
  phone: string | null;
  profilePhotoUrl: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== ADMIN USERS LIST RESPONSE ====================

export interface AdminUsersListResponse {
  filtersApplied: AdminUsersFiltersApplied;
  rows: AdminUserRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export interface AdminUsersFiltersApplied {
  q: string | null;
  roles: UserRole | null;
  isActive: boolean | null;
  hasCustomer: boolean | null;
  hasDriver: boolean | null;
  customerType: CustomerType | null;
  customerApprovalStatus: CustomerApprovalStatus | null;
  driverStatus: DriverStatus | null;
  createdFrom: string | null;
  createdTo: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ==================== QUERY PARAMS ====================

export interface AdminUsersQueryParams {
  q?: string;
  roles?: UserRole;
  isActive?: boolean;
  hasCustomer?: boolean;
  hasDriver?: boolean;
  customerType?: CustomerType;
  customerApprovalStatus?: CustomerApprovalStatus;
  driverStatus?: DriverStatus;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'email' | 'username' | 'fullName' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ==================== ADMIN USERS SUMMARY ====================

export interface AdminUsersSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  byRole: {
    privateCustomers: number;
    businessCustomers: number;
    drivers: number;
    admins: number;
  };
  pendingApprovals: {
    customers: number;
    drivers: number;
  };
}

// ==================== ADMIN USER DETAIL ====================

export interface AdminUserDetail {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  roles: UserRole;
  isActive: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: AdminUserCustomerDetail | null;
  driver: AdminUserDriverDetail | null;
  _count: AdminUserDetailCount;
  recentAdminActions: AdminAction[];
  recentNotifications: RecentNotification[];
  recentDeliveriesCreated: RecentDelivery[];
  recentScheduleChangesRequested: RecentScheduleChange[];
  recentScheduleChangesDecided: RecentScheduleChange[];
}

// ==================== RECENT ACTIVITY TYPES ====================

export interface RecentNotification {
  id: string;
  type: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  status: 'PENDING' | 'SENT' | 'FAILED';
  subject: string | null;
  toEmail: string | null;
  toPhone: string | null;
  deliveryId: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

export interface RecentDelivery {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
}

export interface RecentScheduleChange {
  id: string;
  deliveryId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  requestedByRole: string;
  createdAt: string;
}

export interface AdminUserCustomerDetail {
  id: string;
  customerType: CustomerType;
  approvalStatus: CustomerApprovalStatus;
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessWebsite: string | null;
  phone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  postpaidEnabled: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  defaultPickup: DefaultPickup | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    deliveries: number;
    quotes: number;
  };
}

export interface AdminUserDriverDetail {
  id: string;
  approvedAt: string | null;
  approvedByUserId: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  status: DriverStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  location: DriverLocationDetail | null;
  preferences: DriverPreferencesDetail | null;
  alerts: DriverAlertsDetail | null;
  _count: {
    assignments: number;
    notifications: number;
    payouts: number;
    ratingsReceived: number;
    districts: number;
  };
}

export interface DriverLocationDetail {
  id: string;
  currentLat: number;
  currentLng: number;
  currentAt: string;
  homeBaseLat: number | null;
  homeBaseLng: number | null;
  homeBaseCity: string | null;
  homeBaseState: string | null;
}

export interface DriverPreferencesDetail {
  id: string;
  city: string | null;
  radiusMiles: number | null;
}

export interface DriverAlertsDetail {
  id: string;
  enabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export interface DefaultPickup {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface AdminUserDetailCount {
  adminActions: number;
  assignmentsMade: number;
  auditTargets: number;
  compliancesVerified: number;
  customersApproved: number;
  deliveriesCreated: number;
  disputeNotesAuthored: number;
  driversApproved: number;
  exportsCreated: number;
  notifEvents: number;
  scheduleChangesDecided: number;
  scheduleChangesRequested: number;
  statusActions: number;
}

export interface AdminAction {
  id: string;
  action: string;
  actorUserId: string | null;
  actorType: string;
  customerId: string | null;
  deliveryId: string | null;
  driverId: string | null;
  reason: string | null;
  createdAt: string;
}

// ==================== REQUEST BODIES ====================

export interface SuspendUserRequest {
  reason?: string;
  actorUserId?: string;
}

export interface UnsuspendUserRequest {
  actorUserId?: string;
}

export interface ApproveCustomerRequest {
  note?: string;
  postpaidEnabled?: boolean;
  actorUserId?: string;
}

export interface RejectCustomerRequest {
  reason: string;
  actorUserId?: string;
}

export interface ApproveDriverRequest {
  note?: string;
  actorUserId?: string;
}

export interface RejectDriverRequest {
  reason: string;
  actorUserId?: string;
}

export interface SuspendCustomerRequest {
  reason: string;
  actorUserId?: string;
}

export interface UnsuspendCustomerRequest {
  note?: string;
  actorUserId?: string;
}

export interface SuspendDriverRequest {
  reason: string;
  actorUserId?: string;
}

export interface UnsuspendDriverRequest {
  note?: string;
  actorUserId?: string;
}

// ==================== ADMIN UPDATE USER REQUEST ====================

export interface AdminUpdateUserRequest {
  // User fields
  email?: string;
  username?: string;
  fullName?: string;
  phone?: string;
  // Customer fields (only for users with customer role)
  customer?: {
    phone?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    defaultPickupId?: string;
    postpaidEnabled?: boolean;
  };
  // Driver fields (only for users with driver role)
  driver?: {
    phone?: string;
    profilePhotoUrl?: string;
  };
}

// ==================== CREATE ADMIN USER REQUEST ====================

export interface CreateAdminUserRequest {
  email: string;
  username: string;
  password: string;
  fullName: string;
  phone?: string;
  isActive?: boolean;
  actorUserId: string;
}

export interface CreateAdminUserResponse {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  phone: string | null;
  roles: 'ADMIN';
  isActive: boolean;
  disabledAt?: string | null;
  disabledReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== HELPER CONSTANTS ====================

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  PRIVATE_CUSTOMER: 'Private Customer',
  BUSINESS_CUSTOMER: 'Business Customer',
  DRIVER: 'Driver',
  ADMIN: 'Admin',
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  BUSINESS: 'Business',
  PRIVATE: 'Private',
};

export const CUSTOMER_APPROVAL_STATUS_LABELS: Record<CustomerApprovalStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  SUSPENDED: 'Suspended',
};

// ==================== HELPER FUNCTIONS ====================

export function getUserRoleColor(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'indigo';
    case 'DRIVER':
      return 'sky';
    case 'BUSINESS_CUSTOMER':
      return 'primary';
    case 'PRIVATE_CUSTOMER':
      return 'slate';
    default:
      return 'slate';
  }
}

export function getCustomerApprovalStatusColor(status: CustomerApprovalStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'emerald';
    case 'PENDING':
      return 'amber';
    case 'REJECTED':
      return 'slate';
    case 'SUSPENDED':
      return 'rose';
    default:
      return 'slate';
  }
}

export function getDriverStatusColor(status: DriverStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'emerald';
    case 'PENDING':
      return 'amber';
    case 'SUSPENDED':
      return 'rose';
    default:
      return 'slate';
  }
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
