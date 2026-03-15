// Types for Admin Dashboard - matching API response from GET /api/adminDashboard/overview

// ==================== COMMON TYPES ====================

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

export type CustomerType = 'PRIVATE' | 'BUSINESS';

export type ServiceType = 'HOME_DELIVERY' | 'BETWEEN_LOCATIONS' | 'SERVICE_PICKUP_RETURN';

export type PaymentType = 'PREPAID' | 'POSTPAID';

export type PaymentProvider = 'STRIPE' | 'MANUAL';

export type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';

export type PayoutStatus = 'ELIGIBLE' | 'PAID' | 'FAILED';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

export type TrackingStatus = 'STARTED' | 'STOPPED' | 'PAUSED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type IssueType =
  | 'DELIVERY_COMPLIANCE_MISSING'
  | 'DEALER_APPROVAL_PENDING'
  | 'DRIVER_APPROVAL_PENDING'
  | 'LISTED_WITHOUT_ASSIGNMENT'
  | 'OPS_CONFIRMATION_REQUIRED'
  | 'PAYOUT_ELIGIBLE'
  | 'OPEN_DISPUTE';

// ==================== ACTION TYPE ====================

export interface DashboardAction {
  type: 'NAVIGATE' | 'EXTERNAL' | 'MODAL';
  label: string;
  target: string;
  filters?: Record<string, any>;
}

// ==================== FILTERS ====================

export interface FiltersApplied {
  from: string | null;
  to: string | null;
  datePreset: string | null;
  statuses: string[];
  customerId: string | null;
  customerType: CustomerType | null;
  createdByRole: string | null;
  serviceType: ServiceType | null;
  requiresOpsConfirmation: boolean | null;
  urgentOnly: boolean | null;
  disputedOnly: boolean | null;
}

// ==================== USER & CUSTOMER ====================

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
}

export interface Customer {
  id: string;
  customerType: CustomerType;
  businessName: string | null;
  contactName: string;
}

// ==================== DRIVER ====================

export interface Driver {
  id: string;
  phone: string;
  profilePhotoUrl?: string;
  user: User;
}

// ==================== TRACKING SESSION ====================

export interface TrackingSession {
  id: string;
  status: TrackingStatus;
  startedAt: string | null;
  stoppedAt: string | null;
  drivenMiles: number | null;
}

// ==================== COMPLIANCE ====================

export interface Compliance {
  id: string;
  vinConfirmed: boolean;
  pickupCompletedAt: string | null;
  dropoffCompletedAt: string | null;
  odometerStart: number | null;
  odometerEnd: number | null;
}

// ==================== ASSIGNMENT ====================

export interface Assignment {
  id: string;
  assignedAt: string;
  driver: Driver;
}

// ==================== DELIVERY ====================

export interface Delivery {
  id: string;
  status: DeliveryStatus;
  serviceType?: ServiceType;
  isUrgent?: boolean;
  requiresOpsConfirmation?: boolean;
  pickupAddress: string;
  dropoffAddress: string;
  pickupWindowStart?: string | null;
  dropoffWindowEnd?: string | null;
  createdAt: string;
  updatedAt?: string;
  customer: Customer;
  assignments?: Assignment[];
  trackingSession?: TrackingSession | null;
  compliance?: Compliance | null;
}

// ==================== PAYMENT ====================

export interface Payment {
  id: string;
  amount: number;
  paymentType: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  createdAt: string;
  delivery?: {
    id: string;
    status: DeliveryStatus;
    customer: Customer;
  };
}

// ==================== PAYOUT ====================

export interface Payout {
  id: string;
  grossAmount: number;
  netAmount: number;
  status: PayoutStatus;
  createdAt: string;
  driver: {
    id: string;
    user: User;
  };
  delivery?: {
    id: string;
    status: DeliveryStatus;
    customer: Customer;
  };
}

// ==================== DISPUTE ====================

export interface Dispute {
  id: string;
  status: DisputeStatus;
  reason: string;
  legalHold: boolean;
  createdAt: string;
  delivery: {
    id: string;
    status: DeliveryStatus;
    customer: Customer;
  };
}

// ==================== PENDING DRIVER ====================

export interface PendingDriver {
  id: string;
  phone: string;
  profilePhotoUrl?: string;
  createdAt: string;
  status: ApprovalStatus;
  user: User;
}

// ==================== PENDING CUSTOMER ====================

export interface PendingCustomer {
  id: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  businessName?: string;
  businessPhone?: string;
  createdAt: string;
  approvalStatus: ApprovalStatus;
  user?: User;
}

// ==================== SUMMARY CARDS ====================

export interface DeliveriesInMotion {
  count: number;
  items: Delivery[];
  action: DashboardAction;
}

export interface PendingDriverApprovals {
  count: number;
  items: PendingDriver[];
  action: DashboardAction;
}

export interface OpenClaims {
  count: number;
  items: Dispute[];
  action: DashboardAction;
}

export interface CapturedRevenue {
  count: number;
  amount: number;
  items: Payment[];
  action: DashboardAction;
}

export interface SummaryCards {
  deliveriesInMotion: DeliveriesInMotion;
  pendingDriverApprovals: PendingDriverApprovals;
  openClaims: OpenClaims;
  capturedRevenue: CapturedRevenue;
}

// ==================== ACTIVE DELIVERIES ====================

export interface ActiveDeliveries {
  count: number;
  items: Delivery[];
  action: DashboardAction;
}

// ==================== NEEDS ATTENTION ====================

export interface NeedsAttentionItem {
  issueType: IssueType;
  title: string;
  count: number;
  items: any[]; // Can be Delivery, PendingDriver, PendingCustomer, Payout, Dispute
  action: DashboardAction;
}

// ==================== PRICING SNAPSHOT ====================

export interface PricingTierSnapshot {
  id: string;
  minMiles: number;
  maxMiles: number | null;
  flatPrice: number;
}

export interface CategoryRuleSnapshot {
  id: string;
  category: 'A' | 'B' | 'C';
  minMiles: number;
  maxMiles: number | null;
  baseFee: number | null;
  perMileRate: number | null;
  flatPrice: number | null;
}

export interface PricingSnapshot {
  id: string;
  name: string;
  pricingMode: 'CATEGORY_ABC' | 'FLAT_TIER' | 'PER_MILE';
  baseFee: number;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number;
  transactionFeeFixed: number;
  feePassThrough: boolean;
  driverSharePct: number;
  active: boolean;
  tiers: PricingTierSnapshot[];
  categoryRules: CategoryRuleSnapshot[];
}

// ==================== SCHEDULING POLICY ====================

export interface SchedulingPolicy {
  id: string;
  customerType: CustomerType;
  serviceType: ServiceType;
  defaultMode: 'SAME_DAY' | 'NEXT_DAY';
  sameDayAllowed: boolean;
  bufferMinutes: number;
  sameDayCutoffTime: string;
  maxSameDayMiles: number;
  afterHoursEnabled: boolean;
  requiresOpsConfirmation: boolean;
}

// ==================== ACTOR SUMMARY ====================

export interface ActorSummary {
  privateCustomers: {
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  businessCustomers: {
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  drivers: {
    pending: number;
    approved: number;
    suspended: number;
  };
}

// ==================== SUMMARY ====================

export interface Summary {
  totalDeliveries: number;
  activeTrips: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  deliveriesNeedingOpsConfirmation: number;
  openDisputes: number;
  pendingCustomerApprovals: number;
  pendingDriverApprovals: number;
}

// ==================== PIPELINE ====================

export interface Pipeline {
  draft: number;
  quoted: number;
  listed: number;
  booked: number;
  active: number;
  completed: number;
  cancelled: number;
  expired: number;
  disputed: number;
}

// ==================== FINANCE ====================

export interface Finance {
  authorizedPaymentsCount: number;
  capturedPaymentsCount: number;
  invoicedPostpaidCount: number;
  paidPostpaidCount: number;
  eligiblePayoutCount: number;
  paidPayoutCount: number;
  grossRevenue: number;
  capturedRevenue: number;
  postpaidReceivable: number;
  paidOutAmount: number;
}

// ==================== OPERATIONS ====================

export interface Operations {
  listedWithoutAssignment: number;
  bookedWithoutComplianceReady: number;
  activeWithoutTracking: number;
  deliveriesMissingCompliance: number;
  staleQuotedDeliveries: number;
  staleBookedDeliveries: number;
}

// ==================== DELIVERY BREAKDOWNS ====================

export interface DeliveryBreakdowns {
  byCustomerType: {
    private: number;
    business: number;
  };
  byCreatedByRole: Record<string, number>;
  byServiceType: {
    homeDelivery: number;
    betweenLocations: number;
    servicePickupReturn: number;
  };
}

// ==================== RECENT ====================

export interface Recent {
  pendingPrivateCustomers: PendingCustomer[];
  pendingBusinessCustomers: PendingCustomer[];
  pendingDrivers: PendingDriver[];
  deliveriesNeedingOpsConfirmation: Delivery[];
  recentDisputes: Dispute[];
  recentPayments: Payment[];
  recentPayouts: Payout[];
}

// ==================== MAIN DASHBOARD RESPONSE ====================

export interface AdminDashboardOverview {
  filtersApplied: FiltersApplied;
  summaryCards: SummaryCards;
  activeDeliveries: ActiveDeliveries;
  needsAttention: NeedsAttentionItem[];
  pricingSnapshot: PricingSnapshot | null;
  schedulingPolicy: SchedulingPolicy | null;
  actorSummary: ActorSummary;
  summary: Summary;
  pipeline: Pipeline;
  finance: Finance;
  operations: Operations;
  deliveryBreakdowns: DeliveryBreakdowns;
  recent: Recent;
}

// ==================== QUERY PARAMS ====================

export interface DashboardQueryParams {
  from?: string;
  to?: string;
  datePreset?: string;
  statuses?: string[];
  customerId?: string;
  customerType?: CustomerType;
  createdByRole?: string;
  serviceType?: ServiceType;
  requiresOpsConfirmation?: boolean;
  urgentOnly?: boolean;
  disputedOnly?: boolean;
}
