// Types for Admin Reports API responses

// Common pagination
export interface ReportPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

// Common export info
export interface ReportExport {
  supportedFormats: string[];
}

// Column definition for enterprise reporting
export interface ReportColumn {
  key: string;           // e.g., 'customerName', 'deliveryId'
  label: string;         // Human-friendly label e.g., 'Customer', 'Delivery ID'
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'currency' | 'status' | 'miles' | 'percent';
  width?: number;        // Suggested column width
  visible?: boolean;     // Default visibility
}

// Generic display row - flat key-value pairs
export type DisplayRow = Record<string, string | number | boolean | null>;

// Summary grouping for charts/aggregations
export interface ReportGroupingItem {
  [key: string]: string | number | boolean;
}

// ==================== DELIVERIES REPORT ====================

export interface DeliveriesReportFilters {
  from: string | null;
  to: string | null;
  customerId: string | null;
  driverId: string | null;
  status: string | null;
  serviceType: string | null;
  createdByRole: string | null;
  isUrgent: boolean | null;
  requiresOpsConfirmation: boolean | null;
  disputedOnly: boolean | null;
}

export interface DeliveriesReportSummary {
  totalDeliveries: number;
  urgentCount: number;
  disputedCount: number;
  activePaymentCount: number;
  completedCount: number;
}

export interface DeliveriesReportGrouping {
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

export interface DeliveriesReportRow {
  id: string;
  createdAt: string;
  status: string;
  serviceType: string;
  pickupAddress: string;
  dropoffAddress: string;
  isUrgent: boolean;
  requiresOpsConfirmation: boolean;
  customer: {
    id: string;
    businessName?: string | null;
    contactName?: string | null;
    customerType: string;
  };
  assignedDriver?: {
    id: string;
    fullName: string;
  } | null;
  payment?: {
    id: string;
    status: string;
    amount?: number | null;
  } | null;
  payout?: {
    id: string;
    status: string;
    amount?: number | null;
  } | null;
  dispute?: {
    id: string;
    status: string;
    reason?: string | null;
  } | null;
  trackingSession?: {
    status: string;
    drivenMiles?: number | null;
  } | null;
}

export interface DeliveriesReportResponse {
  reportKey: 'deliveries';
  generatedAt: string;
  filtersApplied: DeliveriesReportFilters;
  columns: ReportColumn[];           // Column definitions for UI tables
  displayRows: DisplayRow[];         // Business-ready flat rows for UI
  rows: DeliveriesReportRow[];       // Raw nested rows (for detail views)
  summary: DeliveriesReportSummary;
  groupings: DeliveriesReportGrouping;
  pagination: ReportPagination;
  export: ReportExport;
}

export interface DeliveriesReportParams {
  from?: string;
  to?: string;
  customerId?: string;
  driverId?: string;
  status?: string;
  serviceType?: string;
  createdByRole?: string;
  isUrgent?: boolean;
  requiresOpsConfirmation?: boolean;
  disputedOnly?: boolean;
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== COMPLIANCE REPORT ====================

export interface ComplianceReportFilters {
  from: string | null;
  to: string | null;
  customerId: string | null;
  driverId: string | null;
  status: string | null;
  verifiedOnly: boolean | null;
  missingOnly: boolean | null;
}

export interface ComplianceReportSummary {
  totalComplianceRows: number;
  vinConfirmedCount: number;
  missingEvidenceCount: number;
  totalDrivenMiles: number;
}

export interface ComplianceReportRow {
  id: string;
  deliveryId: string;
  vinConfirmed: boolean;
  vinVerificationCode: string;
  odometerStart: number | null;
  odometerEnd: number | null;
  pickupCompletedAt: string | null;
  dropoffCompletedAt: string | null;
  pickupPhotoCount: number;
  dropoffPhotoCount: number;
  assignedDriver?: {
    id: string;
    fullName: string;
  } | null;
  latestEvidenceExport?: {
    id: string;
    createdAt: string;
  } | null;
  missingFlags: string[];
}

export interface ComplianceReportResponse {
  reportKey: 'compliance';
  generatedAt: string;
  filtersApplied: ComplianceReportFilters;
  columns: ReportColumn[];
  displayRows: DisplayRow[];
  rows: ComplianceReportRow[];
  summary: ComplianceReportSummary;
  groupings: Record<string, unknown>;
  pagination: ReportPagination;
  export: ReportExport;
}

export interface ComplianceReportParams {
  from?: string;
  to?: string;
  customerId?: string;
  driverId?: string;
  status?: string;
  verifiedOnly?: boolean;
  missingOnly?: boolean;
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== DISPUTES REPORT ====================

export interface DisputesReportFilters {
  from: string | null;
  to: string | null;
  customerId: string | null;
  driverId: string | null;
  status: string | null;
  legalHold: boolean | null;
}

export interface DisputesReportSummary {
  totalDisputes: number;
  legalHoldCount: number;
  openCount: number;
  underReviewCount: number;
  resolvedCount: number;
  closedCount: number;
}

export interface DisputesReportGrouping {
  byStatus: Array<{
    status: string;
    legalHold: boolean;
    count: number;
  }>;
}

export interface DisputesReportRow {
  id: string;
  deliveryId: string;
  openedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  status: string;
  legalHold: boolean;
  reason: string;
  notesCount: number;
  assignedDriver?: {
    id: string;
    fullName: string;
  } | null;
  latestEvidenceExport?: {
    id: string;
    createdAt: string;
  } | null;
  delivery?: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
  } | null;
}

export interface DisputesReportResponse {
  reportKey: 'disputes';
  generatedAt: string;
  filtersApplied: DisputesReportFilters;
  columns: ReportColumn[];
  displayRows: DisplayRow[];
  rows: DisputesReportRow[];
  summary: DisputesReportSummary;
  groupings: DisputesReportGrouping;
  pagination: ReportPagination;
  export: ReportExport;
}

export interface DisputesReportParams {
  from?: string;
  to?: string;
  customerId?: string;
  driverId?: string;
  status?: string;
  legalHold?: boolean;
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== PAYMENTS REPORT ====================

export interface PaymentsReportFilters {
  from: string | null;
  to: string | null;
  customerId: string | null;
  driverId: string | null;
  status: string | null;
  paymentType: string | null;
  prepaidOnly: boolean | null;
  postpaidOnly: boolean | null;
  failedOnly: boolean | null;
}

export interface PaymentsReportSummary {
  totalPayments: number;
  totalAmount: number;
  averageAmount: number;
  authorizedCount: number;
  capturedCount: number;
  invoicedCount: number;
  paidCount: number;
  failedCount: number;
  refundedCount: number;
}

export interface PaymentsReportGrouping {
  byStatusAndType: Array<{
    status: string;
    paymentType: string;
    count: number;
    totalAmount: number;
  }>;
}

export interface PaymentsReportRow {
  id: string;
  deliveryId: string;
  amount: number;
  paymentType: string;
  status: string;
  provider: string;
  invoiceId: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  assignedDriver?: {
    id: string;
    fullName: string;
  } | null;
  delivery?: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
  } | null;
  recentEvents?: Array<{
    type: string;
    status: string;
    createdAt: string;
  }>;
}

export interface PaymentsReportResponse {
  reportKey: 'payments';
  generatedAt: string;
  filtersApplied: PaymentsReportFilters;
  columns: ReportColumn[];
  displayRows: DisplayRow[];
  rows: PaymentsReportRow[];
  summary: PaymentsReportSummary;
  groupings: PaymentsReportGrouping;
  pagination: ReportPagination;
  export: ReportExport;
}

export interface PaymentsReportParams {
  from?: string;
  to?: string;
  customerId?: string;
  driverId?: string;
  status?: string;
  paymentType?: string;
  prepaidOnly?: boolean;
  postpaidOnly?: boolean;
  failedOnly?: boolean;
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== PAYOUTS REPORT ====================

export interface PayoutsReportFilters {
  from: string | null;
  to: string | null;
  customerId: string | null;
  driverId: string | null;
  status: string | null;
}

export interface PayoutsReportSummary {
  totalPayouts: number;
  grossAmount: number;
  insuranceFee: number;
  netAmount: number;
  platformFee: number;
  pendingCount: number;
  eligibleCount: number;
  paidCount: number;
  failedCount: number;
  cancelledCount: number;
}

export interface PayoutsReportGrouping {
  byDriverAndStatus: Array<{
    driverId: string;
    status: string;
    count: number;
    grossAmount: number;
    insuranceFee: number;
    netAmount: number;
    platformFee: number;
  }>;
}

export interface PayoutsReportRow {
  id: string;
  deliveryId: string;
  driverId: string;
  grossAmount: number;
  insuranceFee: number;
  driverSharePct: number;
  netAmount: number;
  platformFee: number;
  status: string;
  paidAt: string | null;
  failedAt: string | null;
  driver?: {
    id: string;
    fullName: string;
  } | null;
  delivery?: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
  } | null;
}

export interface PayoutsReportResponse {
  reportKey: 'payouts';
  generatedAt: string;
  filtersApplied: PayoutsReportFilters;
  columns: ReportColumn[];
  displayRows: DisplayRow[];
  rows: PayoutsReportRow[];
  summary: PayoutsReportSummary;
  groupings: PayoutsReportGrouping;
  pagination: ReportPagination;
  export: ReportExport;
}

export interface PayoutsReportParams {
  from?: string;
  to?: string;
  customerId?: string;
  driverId?: string;
  status?: string;
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== INSURANCE MILEAGE REPORT ====================

export interface InsuranceMileageReportFilters {
  from: string | null;
  to: string | null;
  customerId: string | null;
  driverId: string | null;
  serviceType: string | null;
  groupBy: 'week' | 'month' | null;
}

export interface InsuranceMileageReportSummary {
  totalTrackingSessions: number;
  totalDrivenMiles: number;
  averageMilesPerTrip: number;
  startedCount: number;
  stoppedCount: number;
}

export interface InsuranceMileageReportGrouping {
  byPeriod: Array<{
    period: string;
    tripCount: number;
    totalDrivenMiles: number;
    averageMilesPerTrip: number;
    uniqueDriverCount: number;
    uniqueCustomerCount: number;
  }>;
}

export interface InsuranceMileageReportRow {
  id: string;
  deliveryId: string;
  status: string;
  startedAt: string | null;
  stoppedAt: string | null;
  drivenMiles: number;
  period: string;
  assignedDriver?: {
    id: string;
    fullName: string;
  } | null;
  delivery?: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
  } | null;
}

export interface InsuranceMileageReportResponse {
  reportKey: 'insurance-mileage';
  generatedAt: string;
  filtersApplied: InsuranceMileageReportFilters;
  columns: ReportColumn[];
  displayRows: DisplayRow[];
  rows: InsuranceMileageReportRow[];
  summary: InsuranceMileageReportSummary;
  groupings: InsuranceMileageReportGrouping;
  pagination: ReportPagination;
  export: ReportExport;
}

export interface InsuranceMileageReportParams {
  from?: string;
  to?: string;
  customerId?: string;
  driverId?: string;
  serviceType?: string;
  groupBy?: 'week' | 'month';
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
