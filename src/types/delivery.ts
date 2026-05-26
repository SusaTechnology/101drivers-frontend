// Types for Admin Delivery API responses

export type DeliveryStatus = 
  | 'DRAFT' 
  | 'QUOTED' 
  | 'LISTED' 
  | 'BOOKED' 
  | 'ACTIVE' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'EXPIRED' 
  | 'DISPUTED';

export type ServiceType = 
  | 'HOME_DELIVERY' 
  | 'BETWEEN_LOCATIONS' 
  | 'SERVICE_PICKUP_RETURN';

export type CustomerType = 'BUSINESS' | 'PRIVATE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type DriverStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type TrackingStatus = 'NOT_STARTED' | 'STARTED' | 'STOPPED';

// User base type
interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}

// Customer type
export interface Customer {
  id: string;
  customerType: CustomerType;
  businessName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  approvalStatus: ApprovalStatus;
  phone?: string | null;
  postpaidEnabled: boolean;
  pricingConfigId?: string | null;
  pricingModeOverride?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

// Driver type
export interface Driver {
  id: string;
  phone?: string | null;
  profilePhotoUrl?: string | null;
  status: DriverStatus;
  user: User;
}

// Location types
export interface PickupLocation {
  address: string;
  windowStart?: string | null;
  windowEnd?: string | null;
}

export interface DropoffLocation {
  address: string;
  windowStart?: string | null;
  windowEnd?: string | null;
}

// Scheduling info
export interface Scheduling {
  etaMinutes?: number | null;
  bufferMinutes?: number | null;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  afterHours: boolean;
  isUrgent: boolean;
}

// Assignment type
export interface Assignment {
  id: string;
  driverId: string;
  assignedAt: string;
  unassignedAt?: string | null;
  reason?: string | null;
  driver: Driver;
  assignedBy?: User | null;
}

// Compliance type
export interface Compliance {
  id: string;
  vinConfirmed: boolean;
  vinVerificationCode: string;
  odometerStart?: number | null;
  odometerEnd?: number | null;
  pickupCompletedAt?: string | null;
  dropoffCompletedAt?: string | null;
  verifiedByUserId?: string | null;
  verifiedByAdminAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Dispute type
export interface Dispute {
  id: string;
  reason: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
  legalHold: boolean;
  openedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Payment type
export interface Payment {
  id: string;
  status: string;
  amount?: number | null;
  createdAt?: string | null;
}

// Payout type
export interface Payout {
  id: string;
  status: string;
  amount?: number | null;
  createdAt?: string | null;
}

// Tracking point
export interface TrackingPoint {
  id: string;
  lat: number;
  lng: number;
  recordedAt: string;
}

// Tracking session
export interface TrackingSession {
  id: string;
  status: TrackingStatus;
  startedAt?: string | null;
  stoppedAt?: string | null;
  drivenMiles?: number | null;
  latestPoint?: TrackingPoint | null;
  stale: boolean;
  points?: TrackingPoint[];
  createdAt: string;
  updatedAt: string;
}

// Delivery counts
export interface DeliveryCounts {
  statusHistory: number;
  evidence: number;
  audits: number;
  notifications: number;
  assignments: number;
  evidenceExports: number;
  resubmissions: number;
  scheduleChanges: number;
}

// Delivery list item (from /api/deliveryRequests/admin)
export interface DeliveryListItem {
  id: string;
  status: DeliveryStatus;
  serviceType: ServiceType;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  pickup: PickupLocation;
  dropoff: DropoffLocation;
  scheduling: Scheduling;
  activeAssignment: Assignment | null;
  compliance: Compliance;
  dispute: Dispute | null;
  payment: Payment | null;
  payout: Payout | null;
  tracking: TrackingSession;
  counts: DeliveryCounts;
}

// Filters applied
export interface FiltersApplied {
  status: string | null;
  from: string | null;
  to: string | null;
  customerId: string | null;
  customerType: string | null;
  serviceType: string | null;
  urgentOnly: boolean;
  disputedOnly: boolean;
  requiresOpsConfirmation: boolean;
  withoutAssignment: boolean;
  complianceMissing: boolean;
  activeWithoutTracking: boolean;
  staleTracking: boolean;
}

// Paginated response
export interface AdminDeliveriesResponse {
  items: DeliveryListItem[];
  count: number;
  page: number;
  pageSize: number;
  filtersApplied: FiltersApplied;
}

// Evidence type
export interface Evidence {
  id: string;
  phase: 'PICKUP' | 'DROPOFF';
  type: string;
  slotIndex?: number | null;
  imageUrl?: string | null;
  value?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Status history
export interface StatusHistory {
  id: string;
  deliveryId: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus;
  note?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  actorType: string;
  createdAt: string;
  updatedAt: string;
}

// Notification
export interface DeliveryNotification {
  id: string;
  deliveryId: string;
  customerId?: string | null;
  driverId?: string | null;
  type: string;
  channel: 'EMAIL' | 'SMS';
  status: 'PENDING' | 'SENT' | 'FAILED';
  subject?: string | null;
  body?: string | null;
  toEmail?: string | null;
  toPhone?: string | null;
  templateCode?: string | null;
  payload?: Record<string, unknown>;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Quote type
export interface Quote {
  id: string;
  serviceType: ServiceType;
  pricingMode: string;
  mileageCategory?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  distanceMiles: number;
  estimatedPrice: number;
  feesBreakdown: {
    mode: string;
    total: number;
    baseFare: number;
    insuranceFee: number;
    distanceCharge: number;
    feePassThrough: boolean;
    transactionFee: number;
    pricingConfigId: string;
    transactionFeePct: number;
    transactionFeeFixed: number;
    transactionFeePctAmount: number;
  };
  pricingSnapshot: {
    baseFee: number;
    perMileRate?: number | null;
    pricingMode: string;
    serviceType: string;
    calculatedAt: string;
    insuranceFee: number;
    distanceMiles: number;
    effectiveMode: string;
    driverSharePct: number;
    feePassThrough: boolean;
    mileageCategory?: string | null;
    pricingConfigId: string;
    transactionFeePct: number;
    transactionFeeFixed: number;
  };
  routePolyline?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Financial summary
export interface FinancialSummary {
  deliveryId: string;
  paymentId?: string | null;
  payoutId?: string | null;
  paymentType?: string | null;
  paymentStatus?: string | null;
  payoutStatus?: string | null;
  grossAmount: number;
  driverSharePct: number;
  insuranceFee: number;
  platformFee: number;
  tipAmount: number;
  netPayoutAmount: number;
  invoiceId?: string | null;
}

// Full delivery details (from /api/deliveryRequests/:id/admin)
export interface AdminDeliveryDetail extends DeliveryListItem {
  createdByRole?: string | null;
  customerChose?: string | null;
  pickupAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupPlaceId?: string | null;
  pickupState?: string | null;
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
  dropoffAddress: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffPlaceId?: string | null;
  dropoffState?: string | null;
  dropoffWindowStart?: string | null;
  dropoffWindowEnd?: string | null;
  licensePlate?: string | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vinVerificationCode: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  etaMinutes?: number | null;
  bufferMinutes?: number | null;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  afterHours: boolean;
  isUrgent: boolean;
  urgentBonusAmount?: number | null;
  trackingShareToken?: string | null;
  trackingShareExpiresAt?: string | null;
  customerId: string;
  quoteId?: string | null;
  createdByUserId?: string | null;
  resubmittedFromId?: string | null;
  rating?: number | null;
  tip?: number | null;
  
  // Extended relations
  quote?: Quote | null;
  assignments: Assignment[];
  evidence: Evidence[];
  trackingSession: TrackingSession;
  statusHistory: StatusHistory[];
  audits: unknown[];
  notifications: DeliveryNotification[];
  financialSummary: FinancialSummary;
  _count: DeliveryCounts;
}

// Query params for the list endpoint
export interface AdminDeliveriesQueryParams {
  status?: string | null;
  from?: string | null;
  to?: string | null;
  customerId?: string | null;
  customerType?: string | null;
  serviceType?: string | null;
  urgentOnly?: boolean;
  disputedOnly?: boolean;
  requiresOpsConfirmation?: boolean;
  withoutAssignment?: boolean;
  complianceMissing?: boolean;
  activeWithoutTracking?: boolean;
  staleTracking?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
}

// ==================== ACTION API TYPES ====================

// Assign Driver
export interface AssignDriverRequest {
  driverId: string;
  actorUserId: string;
  reason: string;
}

export interface AssignDriverResponse {
  id: string;
  status: DeliveryStatus;
  assignments: Array<{
    id: string;
    driverId: string;
    unassignedAt: string | null;
  }>;
}

// Approve Compliance
export interface ApproveComplianceRequest {
  actorUserId: string;
  note: string;
}

export interface ApproveComplianceResponse {
  id: string;
  status: DeliveryStatus;
  compliance: {
    id: string;
    verifiedByUserId: string;
    verifiedByAdminAt: string;
  };
}

// Force Cancel
export interface ForceCancelRequest {
  actorUserId: string;
  reason: string;
}

export interface ForceCancelResponse {
  id: string;
  status: DeliveryStatus;
  payment: {
    id: string;
    status: string;
  };
  payout: {
    id: string;
    status: string;
  };
}

// Legal Hold
export interface LegalHoldRequest {
  actorUserId: string;
  legalHold: boolean;
  note: string;
}

export interface LegalHoldResponse {
  id: string;
  status: DeliveryStatus;
  dispute: {
    id: string;
    legalHold: boolean;
  };
}

// Open Dispute
export interface OpenDisputeRequest {
  actorUserId: string;
  reason: string;
  note: string;
  legalHold: boolean;
}

export interface OpenDisputeResponse {
  id: string;
  status: DeliveryStatus;
  dispute: {
    id: string;
    status: string;
    reason: string;
    legalHold: boolean;
    openedAt: string;
  };
}

// API Error Response
export interface DeliveryActionError {
  statusCode: number;
  message: string;
  code: string;
  timestamp: string;
}

// Driver Lookup (minimal)
export interface DriverLookupItem {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
}

// Delivery Lookup (minimal)
export interface DeliveryLookupItem {
  id: string;
  label: string;
  status: DeliveryStatus;
}

// User Lookup (minimal)
export interface UserLookupItem {
  id: string;
  name: string;
  email: string;
  username: string;
  roles: string;
  isActive: boolean;
}
