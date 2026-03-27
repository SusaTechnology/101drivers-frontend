// Types for Admin Dispute API responses

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

// Dispute note
export interface DisputeNote {
  id: string;
  note: string;
  createdAt: string;
  createdByUserId: string;
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
  actorUserId: string;
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
  actorUserId: string;
}

export interface AddDisputeNoteResponse {
  id: string;
  note: string;
  createdAt: string;
  createdByUserId: string;
  disputeId: string;
}

// Change Status
export interface ChangeDisputeStatusRequest {
  status: DisputeStatus;
  note?: string;
  actorUserId: string;
}

export interface ChangeDisputeStatusResponse {
  id: string;
  status: DisputeStatus;
  updatedAt: string;
}

// Resolve Dispute
export interface ResolveDisputeRequest {
  resolutionNote: string;
  actorUserId: string;
}

export interface ResolveDisputeResponse {
  id: string;
  status: DisputeStatus;
  resolvedAt: string;
  updatedAt: string;
}

// Close Dispute
export interface CloseDisputeRequest {
  closingNote: string;
  actorUserId: string;
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
  actorUserId: string;
}

export interface DisputeLegalHoldResponse {
  id: string;
  legalHold: boolean;
  updatedAt: string;
}
