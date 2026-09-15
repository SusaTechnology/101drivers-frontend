// Payment types for admin API

export type PaymentStatus =
  | 'INVOICED'
  | 'PAID'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'VOIDED'
  | 'REFUNDED'
  | 'FAILED'               // Legacy prepaid failure
  | 'PENDING_STRIPE_USAGE'  // Postpaid: delivery created, InvoiceItem not yet reported
  | 'USAGE_REPORTED'        // Postpaid: InvoiceItem created, awaiting weekly invoice
  | 'CHARGE_FAILED';        // Postpaid: weekly charge failed
export type PaymentType = 'POSTPAID' | 'PREPAID';
export type PaymentProvider = 'MANUAL' | 'STRIPE';
export type PayoutStatus = 'ELIGIBLE' | 'PAID' | 'PENDING' | 'FAILED';

// Payment event type
export type PaymentEventType = 'AUTHORIZE' | 'CAPTURE' | 'VOID' | 'REFUND' | 'INVOICE' | 'PAYMENT' | 'PAYOUT';

// Payment event
export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  status: string;
  amount: number;
  message: string;
  providerRef: string | null;
  createdAt: string;
}

// Payout info
export interface PaymentPayout {
  id: string;
  status: PayoutStatus;
  netAmount: number;
  paidAt: string | null;
}

// Delivery info within payment
export interface PaymentDelivery {
  id: string;
  status: string;
  serviceType: string;
  customerId: string;
  pickupAddress: string;
  dropoffAddress: string;
  customer: {
    id: string;
    customerType: 'BUSINESS' | 'PRIVATE';
    businessName?: string;
    contactName?: string;
    contactEmail?: string;
  };
  payout?: PaymentPayout;
}

// Payment list item
export interface PaymentListItem {
  id: string;
  amount: number;
  paymentType: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  refundedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  providerChargeId: string | null;
  providerPaymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
  delivery: PaymentDelivery;
  events?: PaymentEvent[];
}

// Admin payments query params
export interface AdminPaymentsQueryParams {
  page?: number;
  pageSize?: number;
  status?: PaymentStatus;
  /** Comma-separated status list for OR filtering (e.g. "CHARGE_FAILED,FAILED").
   *  Takes precedence over `status`. Used by the "Failed Only" quick filter. */
  statuses?: string;
  paymentType?: PaymentType;
  provider?: PaymentProvider;
  customerId?: string;
  deliveryId?: string;
  from?: string;
  to?: string;
  invoicedOnly?: boolean;
  unpaidOnly?: boolean;
}

// Admin payments response
export interface AdminPaymentsResponse {
  items: PaymentListItem[];
  count: number;
  page: number;
  pageSize: number;
  filtersApplied: {
    status: string | null;
    statuses: string | null;
    paymentType: string | null;
    provider: string | null;
    customerId: string | null;
    deliveryId: string | null;
    from: string | null;
    to: string | null;
    invoicedOnly: boolean;
    unpaidOnly: boolean;
  };
}

// ── Admin payments period summary (KPI cards) ──
//
// Returned by GET /api/payments/admin/summary. Computed fleet-wide over a
// whole period with a single groupBy — deliberately NOT derived from the
// paginated list, so the KPI numbers stay stable no matter which page or
// filter the admin is on. Defaults to ALL TIME when no range is sent.
export interface AdminPaymentSummary {
  /** Actual period used (ISO). Null = unbounded (all time) on that side. */
  from: string | null;
  to: string | null;
  /** True when neither from nor to was supplied (all-time default). */
  usesDefaultPeriod: boolean;
  /** Status → payment count for the period. */
  counts: Record<string, number>;
  total: number;
  totalAmount: number;
  /** CHARGE_FAILED + FAILED convenience total. */
  failedTotal: number;
}

// Payment detail (full payment info)
export interface PaymentDetail extends PaymentListItem {
  events: PaymentEvent[];
}

// ── Admin Payment Detail (single-payment view) ──
//
// Returned by GET /api/payments/admin/:id. Includes more than the list item:
//   - pickup window times (for context)
//   - pickupPin (for ops verification)
//   - active driver assignment (driver + user)
//   - lockInAmount (for trips with captured lock-in)
//   - ALL payment events (list endpoint only returns latest 5)
export interface AdminPaymentDetailDelivery {
  id: string;
  status: string;
  serviceType: string;
  customerId: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  dropoffWindowStart: string | null;
  dropoffWindowEnd: string | null;
  pickupPin: string | null;
  customer: {
    id: string;
    userId: string;
    customerType: 'BUSINESS' | 'PRIVATE';
    businessName?: string;
    contactName?: string;
    contactEmail?: string;
  };
  assignments?: Array<{
    id: string;
    driverId: string;
    assignedAt: string;
    driver: {
      id: string;
      status: string;
      user: {
        id: string;
        fullName: string | null;
        email: string;
      };
    };
  }>;
  payout?: PaymentPayout;
}

export interface AdminPaymentDetail {
  id: string;
  amount: number;
  paymentType: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  refundedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  failedAt: string | null;
  providerChargeId: string | null;
  providerPaymentIntentId: string | null;
  lockInAmount: number | null;
  stripeInvoiceId: string | null;
  stripeInvoiceItemId: string | null;
  attemptCount: number | null;
  createdAt: string;
  updatedAt: string;
  delivery: AdminPaymentDetailDelivery;
  events: PaymentEvent[];
}

// Action request/response types
export interface MarkInvoicedRequest {
  actorUserId: string;
  invoiceId: string;
  note?: string;
}

export interface MarkInvoicedResponse {
  id: string;
  amount: number;
  paymentType: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string;
  authorizedAt: string | null;
  capturedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  delivery: {
    id: string;
  };
}

export interface MarkPaidRequest {
  actorUserId: string;
  note?: string;
}

export interface MarkPaidResponse {
  id: string;
  amount: number;
  paymentType: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string | null;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
  delivery: {
    id: string;
  };
}

export interface MarkPayoutPaidRequest {
  actorUserId: string;
  providerTransferId: string;
  note?: string;
}

export interface MarkPayoutPaidResponse {
  id: string;
  amount: number;
  paymentType: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string | null;
  delivery: {
    id: string;
    payout: PaymentPayout;
  };
}
