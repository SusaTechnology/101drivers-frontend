// Types for Admin Dispute API responses

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'CLOSED';

// Dispute note
export interface DisputeNote {
  id: string;
  note: string;
  createdAt: string;
  authorUserId: string | null;
  author?: {
    id: string;
    username: string;
    email: string;
    fullName: string | null;
  } | null;
}

// Delivery summary within dispute
export interface DisputeDelivery {
  id: string;
  status: string;
  serviceType: string;
  customerId: string;
  quoteId: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  updatedAt: string;
}

// Admin user who resolved the dispute (if any)
export interface DisputeResolvedBy {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
}

// Dispute list item
export interface DisputeListItem {
  id: string;
  deliveryId: string;
  reason: string;
  legalHold: boolean;
  status: DisputeStatus;
  openedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  // New audit/refund fields (nullable — only set when relevant)
  rejectionReason?: string | null;
  stripeRefundId?: string | null;
  resolvedById?: string | null;
  resolvedBy?: DisputeResolvedBy | null;
  createdAt: string;
  updatedAt: string;
  delivery: DisputeDelivery;
  notes: DisputeNote[];
  _count: {
    notes: number;
  };
}

// Query params for the list endpoint
export interface AdminDisputesQueryParams {
  status?: DisputeStatus | null;
}

// Admin disputes response (array of disputes)
export type AdminDisputesResponse = DisputeListItem[];

// ==================== ACTION API TYPES ====================

// Open Dispute
export interface OpenDisputeRequest {
  deliveryId: string;
  reason: string;
}

export interface OpenDisputeResponse {
  id: string;
  deliveryId: string;
  reason: string;
  status: DisputeStatus;
  legalHold: boolean;
  openedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Add Note
export interface AddDisputeNoteRequest {
  note: string;
}

export interface AddDisputeNoteResponse {
  id: string;
  note: string;
  createdAt: string;
  authorUserId: string | null;
  disputeId: string;
}

// Change Status
export interface ChangeDisputeStatusRequest {
  status: DisputeStatus;
  note?: string;
}

export interface ChangeDisputeStatusResponse {
  id: string;
  status: DisputeStatus;
  updatedAt: string;
}

// Resolve Dispute — approveRefund is required.
// approveRefund=true  → issue a refund (full or partial via refundAmount).
// approveRefund=false → resolve without refund (driver-favor).
export interface ResolveDisputeRequest {
  approveRefund: boolean;
  refundAmount?: number | null;
  resolutionNote?: string;
}

export interface ResolveDisputeResponse {
  id: string;
  status: DisputeStatus;
  resolvedAt: string;
  stripeRefundId?: string | null;
  updatedAt: string;
}

// Reject Dispute — rejectionReason is required.
export interface RejectDisputeRequest {
  rejectionReason: string;
  note?: string;
}

export interface RejectDisputeResponse {
  id: string;
  status: DisputeStatus;
  rejectionReason: string;
  resolvedAt: string;
  updatedAt: string;
}

// Close Dispute
export interface CloseDisputeRequest {
  closingNote?: string;
}

export interface CloseDisputeResponse {
  id: string;
  status: DisputeStatus;
  closedAt: string;
  updatedAt: string;
}

// Legal Hold
export interface DisputeLegalHoldRequest {
  legalHold: boolean;
  note?: string;
}

export interface DisputeLegalHoldResponse {
  id: string;
  legalHold: boolean;
  updatedAt: string;
}
