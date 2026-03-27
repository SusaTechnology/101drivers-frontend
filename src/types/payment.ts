// Payment types for admin API

export type PaymentStatus = 'INVOICED' | 'PAID' | 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'REFUNDED';
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

// Payment detail (full payment info)
export interface PaymentDetail extends PaymentListItem {
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
