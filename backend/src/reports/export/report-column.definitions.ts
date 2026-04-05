export type EnterpriseReportKey =
  | "deliveries"
  | "compliance"
  | "disputes"
  | "payments"
  | "payouts"
  | "insurance-mileage";

export type ReportColumnType =
  | "string"
  | "number"
  | "money"
  | "percent"
  | "boolean"
  | "datetime"
  | "status"
  | "miles";

export type ReportColumnDefinition = {
  key: string;
  label: string;
  type?: ReportColumnType;
  width?: number;
};

export const REPORT_COLUMNS: Record<
  EnterpriseReportKey,
  ReportColumnDefinition[]
> = {
  deliveries: [
    { key: "deliveryId", label: "Delivery ID", width: 22 },
    { key: "status", label: "Status", type: "status", width: 18 },
    { key: "serviceType", label: "Service Type", width: 18 },
    { key: "customerName", label: "Customer", width: 28 },
    { key: "driverName", label: "Assigned Driver", width: 28 },
    { key: "pickupAddress", label: "Pickup Address", width: 36 },
    { key: "dropoffAddress", label: "Dropoff Address", width: 36 },
    { key: "pickupWindowStart", label: "Pickup Window Start", type: "datetime", width: 22 },
    { key: "dropoffWindowEnd", label: "Dropoff Window End", type: "datetime", width: 22 },
    { key: "urgent", label: "Urgent", type: "boolean", width: 12 },
    { key: "opsConfirmationRequired", label: "Ops Confirmation Required", type: "boolean", width: 18 },
    { key: "paymentStatus", label: "Payment Status", type: "status", width: 18 },
    { key: "payoutStatus", label: "Payout Status", type: "status", width: 18 },
  ],
  compliance: [
    { key: "deliveryId", label: "Delivery ID", width: 22 },
    { key: "deliveryStatus", label: "Delivery Status", type: "status", width: 18 },
    { key: "customerName", label: "Customer", width: 28 },
    { key: "driverName", label: "Assigned Driver", width: 28 },
    { key: "vinConfirmed", label: "VIN Confirmed", type: "boolean", width: 14 },
    { key: "vinCode", label: "VIN Code", width: 16 },
    { key: "odometerStart", label: "Odometer Start", type: "number", width: 16 },
    { key: "odometerEnd", label: "Odometer End", type: "number", width: 16 },
    { key: "pickupCompletedAt", label: "Pickup Completed At", type: "datetime", width: 22 },
    { key: "dropoffCompletedAt", label: "Dropoff Completed At", type: "datetime", width: 22 },
    { key: "pickupPhotoCount", label: "Pickup Photos", type: "number", width: 14 },
    { key: "dropoffPhotoCount", label: "Dropoff Photos", type: "number", width: 14 },
    { key: "drivenMiles", label: "Driven Miles", type: "miles", width: 14 },
    { key: "missingFlags", label: "Missing Flags", width: 42 },
  ],
  disputes: [
    { key: "disputeId", label: "Dispute ID", width: 22 },
    { key: "deliveryId", label: "Delivery ID", width: 22 },
    { key: "status", label: "Status", type: "status", width: 18 },
    { key: "legalHold", label: "Legal Hold", type: "boolean", width: 14 },
    { key: "customerName", label: "Customer", width: 28 },
    { key: "driverName", label: "Assigned Driver", width: 28 },
    { key: "reason", label: "Reason", width: 40 },
    { key: "openedAt", label: "Opened At", type: "datetime", width: 22 },
    { key: "resolvedAt", label: "Resolved At", type: "datetime", width: 22 },
    { key: "closedAt", label: "Closed At", type: "datetime", width: 22 },
    { key: "notesCount", label: "Notes Count", type: "number", width: 14 },
  ],
  payments: [
    { key: "paymentId", label: "Payment ID", width: 22 },
    { key: "deliveryId", label: "Delivery ID", width: 22 },
    { key: "customerName", label: "Customer", width: 28 },
    { key: "driverName", label: "Assigned Driver", width: 28 },
    { key: "amount", label: "Amount", type: "money", width: 16 },
    { key: "paymentType", label: "Payment Type", width: 16 },
    { key: "status", label: "Status", type: "status", width: 18 },
    { key: "authorizedAt", label: "Authorized At", type: "datetime", width: 22 },
    { key: "capturedAt", label: "Captured At", type: "datetime", width: 22 },
    { key: "paidAt", label: "Paid At", type: "datetime", width: 22 },
    { key: "failedAt", label: "Failed At", type: "datetime", width: 22 },
    { key: "refundedAt", label: "Refunded At", type: "datetime", width: 22 },
    { key: "provider", label: "Provider", width: 16 },
  ],
  payouts: [
    { key: "payoutId", label: "Payout ID", width: 22 },
    { key: "deliveryId", label: "Delivery ID", width: 22 },
    { key: "driverName", label: "Driver", width: 28 },
    { key: "customerName", label: "Customer", width: 28 },
    { key: "grossAmount", label: "Gross Amount", type: "money", width: 16 },
    { key: "insuranceFee", label: "Insurance Fee", type: "money", width: 16 },
    { key: "driverSharePct", label: "Driver Share %", type: "percent", width: 14 },
    { key: "netAmount", label: "Net Amount", type: "money", width: 16 },
    { key: "platformFee", label: "Platform Fee", type: "money", width: 16 },
    { key: "status", label: "Status", type: "status", width: 18 },
    { key: "paidAt", label: "Paid At", type: "datetime", width: 22 },
  ],
  "insurance-mileage": [
    { key: "period", label: "Period", width: 18 },
    { key: "tripCount", label: "Trip Count", type: "number", width: 14 },
    { key: "totalDrivenMiles", label: "Total Driven Miles", type: "miles", width: 18 },
    { key: "averageMilesPerTrip", label: "Average Miles / Trip", type: "miles", width: 18 },
    { key: "uniqueDriverCount", label: "Unique Drivers", type: "number", width: 16 },
    { key: "uniqueCustomerCount", label: "Unique Customers", type: "number", width: 18 },
  ],
};