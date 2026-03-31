// Types for Scheduling Policy API

// Enums
export type CustomerType = 'BUSINESS' | 'PRIVATE';
export type ServiceType = 'HOME_DELIVERY' | 'BETWEEN_LOCATIONS' | 'SERVICE_PICKUP_RETURN';
export type DefaultMode = 'SAME_DAY' | 'NEXT_DAY';
export type SameDayStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'CUTOFF_PASSED' | 'OUT_OF_RANGE';

// Scheduling Policy
export interface SchedulingPolicy {
  id: string;
  active: boolean;
  customerType: CustomerType;
  serviceType: ServiceType | null;
  defaultMode: DefaultMode;
  sameDayCutoffTime: string | null; // HH:mm format
  maxSameDayMiles: number | null;
  bufferMinutes: number;
  afterHoursEnabled: boolean;
  requiresOpsConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}

// Query params for list
export interface SchedulingPoliciesQueryParams {
  active?: boolean;
  customerType?: CustomerType;
  serviceType?: ServiceType;
}

// Upsert request body
export interface SchedulingPolicyUpsertRequest {
  id?: string;
  customerType: CustomerType;
  serviceType?: ServiceType | null;
  defaultMode: DefaultMode;
  sameDayCutoffTime?: string | null; // HH:mm format
  maxSameDayMiles?: number | null;
  bufferMinutes: number;
  afterHoursEnabled: boolean;
  requiresOpsConfirmation: boolean;
  active?: boolean;
}

// Summary response (from /api/schedulingPolicies/admin/summary)
export interface SchedulingPoliciesSummary {
  totalPolicies: number;
  activePolicies: number;
  inactivePolicies: number;
  byCustomerType: Array<{
    customerType: CustomerType;
    count: number;
  }>;
  byServiceType: Array<{
    serviceType: ServiceType | null;
    count: number;
  }>;
}

// Preview request for schedule feasibility
export interface SchedulePreviewRequest {
  customerId?: string;
  customerType?: CustomerType;
  serviceType?: ServiceType;
  requestCreatedAt?: string; // ISO date string
  distanceMiles?: number;
  etaMinutes?: number;
  customerChose: 'PICKUP_WINDOW' | 'DROPOFF_WINDOW';
  pickupWindowStart?: string; // ISO date string
  pickupWindowEnd?: string; // ISO date string
  dropoffWindowStart?: string; // ISO date string
  dropoffWindowEnd?: string; // ISO date string
  afterHoursRequested?: boolean;
}

// Time slot
export interface TimeSlot {
  label: string;
  start: string; // ISO date string
  end: string; // ISO date string
}

// Matched slot
export interface MatchedSlot {
  label: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

// Schedule preview response
export interface SchedulePreviewResponse {
  policy: SchedulingPolicy;
  sameDayStatus: SameDayStatus;
  sameDayEligible: boolean;
  afterHours: boolean;
  requiresOpsConfirmation: boolean;
  totalTravelMinutes: number;
  bufferMinutes: number;
  reasons: string[];
  warnings: string[];
  requested: {
    customerChose: 'PICKUP_WINDOW' | 'DROPOFF_WINDOW';
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    dropoffWindowStart: string | null;
    dropoffWindowEnd: string | null;
    requestCreatedAt: string | null;
    distanceMiles: number | null;
    etaMinutes: number | null;
  };
  resolved: {
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    dropoffWindowStart: string | null;
    dropoffWindowEnd: string | null;
  };
  matchedSlots: {
    pickup: MatchedSlot | null;
    dropoff: MatchedSlot | null;
  };
  suggestedSlots: {
    pickup: TimeSlot[];
    dropoff: TimeSlot[];
  };
}

// ==================== Operating Hours ====================

// Day of week (1 = Monday, 7 = Sunday)
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Operating Hour
export interface OperatingHour {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Query params for operating hours list
export interface OperatingHoursQueryParams {
  active?: boolean;
  dayOfWeek?: DayOfWeek;
}

// Upsert request body for operating hours
export interface OperatingHourUpsertRequest {
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  active?: boolean;
}

// Weekly grouped operating hours response
export interface WeeklyOperatingHours {
  days: Array<{
    dayOfWeek: DayOfWeek;
    items: OperatingHour[];
  }>;
}

// ==================== Time Slot Templates ====================

// Time Slot Template
export interface TimeSlotTemplate {
  id: string;
  label: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Query params for time slot templates list
export interface TimeSlotTemplatesQueryParams {
  active?: boolean;
  label?: string;
}

// Upsert request body for time slot templates
export interface TimeSlotTemplateUpsertRequest {
  id?: string;
  label: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  active?: boolean;
}

// Time slot catalog response
export interface TimeSlotCatalog {
  items: TimeSlotTemplate[];
}

// ==================== Helper Constants ====================

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const DAY_OF_WEEK_SHORT: Record<DayOfWeek, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};
