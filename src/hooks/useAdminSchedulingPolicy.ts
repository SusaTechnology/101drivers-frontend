// Hooks for admin scheduling policy API
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery';
import type {
  SchedulingPolicy,
  SchedulingPoliciesQueryParams,
  SchedulingPolicyUpsertRequest,
  SchedulingPoliciesSummary,
  SchedulePreviewRequest,
  SchedulePreviewResponse,
  OperatingHour,
  OperatingHoursQueryParams,
  OperatingHourUpsertRequest,
  WeeklyOperatingHours,
  TimeSlotTemplate,
  TimeSlotTemplatesQueryParams,
  TimeSlotTemplateUpsertRequest,
  TimeSlotCatalog,
} from '@/types/scheduling';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from params
 */
function buildQueryString(params: SchedulingPoliciesQueryParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.active !== undefined) searchParams.set('active', String(params.active));
  if (params.customerType) searchParams.set('customerType', params.customerType);
  if (params.serviceType) searchParams.set('serviceType', params.serviceType);
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook for fetching all scheduling policies (admin list)
 */
export function useSchedulingPolicies(params: SchedulingPoliciesQueryParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<SchedulingPolicy[]>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/admin${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000, // 1 minute
    queryKey: ['scheduling-policies', paramsKey],
  });
}

/**
 * Hook for fetching active scheduling policies only
 */
export function useActiveSchedulingPolicies() {
  return useDataQuery<SchedulingPolicy[]>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/admin/active`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['scheduling-policies-active'],
  });
}

/**
 * Hook for fetching scheduling policies summary (dashboard widgets)
 */
export function useSchedulingPoliciesSummary() {
  return useDataQuery<SchedulingPoliciesSummary>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/admin/summary`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['scheduling-policies-summary'],
  });
}

/**
 * Hook for upserting (create/update) a scheduling policy
 */
export function useUpsertSchedulingPolicy() {
  return useDataMutation<SchedulingPolicy, SchedulingPolicyUpsertRequest>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/admin/upsert`,
    method: 'POST',
    invalidateQueryKey: [['scheduling-policies'], ['scheduling-policies-active'], ['scheduling-policies-summary']],
  });
}

/**
 * Hook for activating a scheduling policy
 * Usage: mutate({ pathParams: { id: 'policy-id' } })
 */
export function useActivateSchedulingPolicy() {
  return useDataMutation<SchedulingPolicy, Record<string, never>>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/:id/activate`,
    method: 'POST',
    invalidateQueryKey: [['scheduling-policies'], ['scheduling-policies-active'], ['scheduling-policies-summary']],
  });
}

/**
 * Hook for deactivating a scheduling policy
 * Usage: mutate({ pathParams: { id: 'policy-id' } })
 */
export function useDeactivateSchedulingPolicy() {
  return useDataMutation<SchedulingPolicy, Record<string, never>>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/:id/deactivate`,
    method: 'POST',
    invalidateQueryKey: [['scheduling-policies'], ['scheduling-policies-active'], ['scheduling-policies-summary']],
  });
}

/**
 * Hook for schedule feasibility preview
 */
export function useSchedulePreview() {
  return useDataMutation<SchedulePreviewResponse, SchedulePreviewRequest>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/admin/preview`,
    method: 'POST',
  });
}

/**
 * Hook for fetching effective policy for a customer/service combination
 */
export function useEffectivePolicy(customerType?: string, serviceType?: string, customerId?: string) {
  const searchParams = new URLSearchParams();
  
  if (customerId) {
    searchParams.set('customerId', customerId);
  } else if (customerType) {
    searchParams.set('customerType', customerType);
  }
  if (serviceType) {
    searchParams.set('serviceType', serviceType);
  }
  
  const queryString = searchParams.toString();
  const enabled = !!(customerId || customerType);
  
  return useDataQuery<SchedulingPolicy>({
    apiEndPoint: `${API_BASE_URL}/api/schedulingPolicies/admin/effective${queryString ? `?${queryString}` : ''}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['scheduling-policy-effective', customerId, customerType, serviceType],
    enabled,
  });
}

/**
 * Helper to format time (HH:mm) for display
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '—';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Helper to get customer type label
 */
export function getCustomerTypeLabel(type: string | null): string {
  switch (type) {
    case 'BUSINESS': return 'Business';
    case 'PRIVATE': return 'Private';
    default: return 'All';
  }
}

/**
 * Helper to get service type label
 */
export function getServiceTypeLabel(type: string | null): string {
  switch (type) {
    case 'HOME_DELIVERY': return 'Home Delivery';
    case 'BETWEEN_LOCATIONS': return 'Between Locations';
    case 'SERVICE_PICKUP_RETURN': return 'Service Pickup/Return';
    default: return 'All Services';
  }
}

/**
 * Helper to get default mode label
 */
export function getDefaultModeLabel(mode: string): string {
  switch (mode) {
    case 'SAME_DAY': return 'Same Day';
    case 'NEXT_DAY': return 'Next Day';
    default: return mode;
  }
}

// ==================== OPERATING HOURS HOOKS ====================

/**
 * Build query string for operating hours
 */
function buildOperatingHoursQueryString(params: OperatingHoursQueryParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.active !== undefined) searchParams.set('active', String(params.active));
  if (params.dayOfWeek !== undefined) searchParams.set('dayOfWeek', String(params.dayOfWeek));
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook for fetching operating hours list
 */
export function useOperatingHours(params: OperatingHoursQueryParams = {}) {
  const queryString = buildOperatingHoursQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<OperatingHour[]>({
    apiEndPoint: `${API_BASE_URL}/api/operatingHours/admin${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['operating-hours', paramsKey],
  });
}

/**
 * Hook for fetching active operating hours
 */
export function useActiveOperatingHours() {
  return useDataQuery<OperatingHour[]>({
    apiEndPoint: `${API_BASE_URL}/api/operatingHours/admin/active`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['operating-hours-active'],
  });
}

/**
 * Hook for fetching weekly grouped operating hours
 */
export function useWeeklyOperatingHours() {
  return useDataQuery<WeeklyOperatingHours>({
    apiEndPoint: `${API_BASE_URL}/api/operatingHours/admin/weekly`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['operating-hours-weekly'],
  });
}

/**
 * Hook for upserting operating hours
 */
export function useUpsertOperatingHour() {
  return useDataMutation<OperatingHour, OperatingHourUpsertRequest>({
    apiEndPoint: `${API_BASE_URL}/api/operatingHours/admin/upsert`,
    method: 'POST',
    invalidateQueryKey: [['operating-hours'], ['operating-hours-active'], ['operating-hours-weekly']],
  });
}

/**
 * Hook for activating operating hours
 */
export function useActivateOperatingHour() {
  return useDataMutation<OperatingHour, Record<string, never>>({
    apiEndPoint: `${API_BASE_URL}/api/operatingHours/:id/activate`,
    method: 'POST',
    invalidateQueryKey: [['operating-hours'], ['operating-hours-active'], ['operating-hours-weekly']],
  });
}

/**
 * Hook for deactivating operating hours
 */
export function useDeactivateOperatingHour() {
  return useDataMutation<OperatingHour, Record<string, never>>({
    apiEndPoint: `${API_BASE_URL}/api/operatingHours/:id/deactivate`,
    method: 'POST',
    invalidateQueryKey: [['operating-hours'], ['operating-hours-active'], ['operating-hours-weekly']],
  });
}

// ==================== TIME SLOT TEMPLATES HOOKS ====================

/**
 * Build query string for time slot templates
 */
function buildTimeSlotTemplatesQueryString(params: TimeSlotTemplatesQueryParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.active !== undefined) searchParams.set('active', String(params.active));
  if (params.label) searchParams.set('label', params.label);
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook for fetching time slot templates list
 */
export function useTimeSlotTemplates(params: TimeSlotTemplatesQueryParams = {}) {
  const queryString = buildTimeSlotTemplatesQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<TimeSlotTemplate[]>({
    apiEndPoint: `${API_BASE_URL}/api/timeSlotTemplates/admin${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['time-slot-templates', paramsKey],
  });
}

/**
 * Hook for fetching active time slot templates
 */
export function useActiveTimeSlotTemplates() {
  return useDataQuery<TimeSlotTemplate[]>({
    apiEndPoint: `${API_BASE_URL}/api/timeSlotTemplates/admin/active`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['time-slot-templates-active'],
  });
}

/**
 * Hook for fetching time slot catalog
 */
export function useTimeSlotCatalog() {
  return useDataQuery<TimeSlotCatalog>({
    apiEndPoint: `${API_BASE_URL}/api/timeSlotTemplates/admin/catalog`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['time-slot-catalog'],
  });
}

/**
 * Hook for upserting time slot templates
 */
export function useUpsertTimeSlotTemplate() {
  return useDataMutation<TimeSlotTemplate, TimeSlotTemplateUpsertRequest>({
    apiEndPoint: `${API_BASE_URL}/api/timeSlotTemplates/admin/upsert`,
    method: 'POST',
    invalidateQueryKey: [['time-slot-templates'], ['time-slot-templates-active'], ['time-slot-catalog']],
  });
}

/**
 * Hook for activating time slot templates
 */
export function useActivateTimeSlotTemplate() {
  return useDataMutation<TimeSlotTemplate, Record<string, never>>({
    apiEndPoint: `${API_BASE_URL}/api/timeSlotTemplates/:id/activate`,
    method: 'POST',
    invalidateQueryKey: [['time-slot-templates'], ['time-slot-templates-active'], ['time-slot-catalog']],
  });
}

/**
 * Hook for deactivating time slot templates
 */
export function useDeactivateTimeSlotTemplate() {
  return useDataMutation<TimeSlotTemplate, Record<string, never>>({
    apiEndPoint: `${API_BASE_URL}/api/timeSlotTemplates/:id/deactivate`,
    method: 'POST',
    invalidateQueryKey: [['time-slot-templates'], ['time-slot-templates-active'], ['time-slot-catalog']],
  });
}
