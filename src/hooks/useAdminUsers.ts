// Hooks for Admin Users API
import { useDataQuery, useDataMutation, getUser } from '@/lib/tanstack/dataQuery';
import type {
  AdminUsersListResponse,
  AdminUsersQueryParams,
  AdminUsersSummary,
  AdminUserDetail,
  AdminUserRow,
  SuspendUserRequest,
  UnsuspendUserRequest,
  ApproveCustomerRequest,
  RejectCustomerRequest,
  ApproveDriverRequest,
  RejectDriverRequest,
  InviteDriverRequest,
  SuspendCustomerRequest,
  UnsuspendCustomerRequest,
  SuspendDriverRequest,
  UnsuspendDriverRequest,
  AdminUpdateUserRequest,
  CreateAdminUserRequest,
  CreateAdminUserResponse,
} from '@/types/users';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Get current actor user ID
export function getActorUserId(): string | undefined {
  return getUser()?.id;
}

// ==================== QUERY STRING BUILDER ====================

function buildAdminUsersQueryString(params: AdminUsersQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  if (params.roles) searchParams.set('roles', params.roles);
  if (params.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  if (params.hasCustomer !== undefined) searchParams.set('hasCustomer', String(params.hasCustomer));
  if (params.hasDriver !== undefined) searchParams.set('hasDriver', String(params.hasDriver));
  if (params.customerType) searchParams.set('customerType', params.customerType);
  if (params.customerApprovalStatus) searchParams.set('customerApprovalStatus', params.customerApprovalStatus);
  if (params.driverStatus) searchParams.set('driverStatus', params.driverStatus);
  if (params.createdFrom) searchParams.set('createdFrom', params.createdFrom);
  if (params.createdTo) searchParams.set('createdTo', params.createdTo);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ==================== ADMIN USERS LIST ====================

/**
 * Hook for fetching admin users table with filters and pagination
 * GET /api/users/admin
 */
export function useAdminUsers(params: AdminUsersQueryParams = {}) {
  const queryString = buildAdminUsersQueryString(params);
  const paramsKey = JSON.stringify(params);

  return useDataQuery<AdminUsersListResponse>({
    apiEndPoint: `${API_BASE_URL}/api/users/admin${queryString}`,
    noFilter: true,
    staleTime: 30 * 1000, // 30 seconds
    queryKey: ['admin-users', paramsKey],
  });
}

// ==================== ADMIN USERS SUMMARY ====================

/**
 * Hook for fetching admin users dashboard cards
 * GET /api/users/admin/summary
 */
export function useAdminUsersSummary() {
  return useDataQuery<AdminUsersSummary>({
    apiEndPoint: `${API_BASE_URL}/api/users/admin/summary`,
    noFilter: true,
    staleTime: 60 * 1000, // 1 minute
    queryKey: ['admin-users-summary'],
  });
}

// ==================== ADMIN USER DETAIL ====================

/**
 * Hook for fetching admin user detail page
 * GET /api/users/:id/admin-detail
 */
export function useAdminUserDetail(userId: string | undefined) {
  return useDataQuery<AdminUserDetail>({
    apiEndPoint: `${API_BASE_URL}/api/users/${userId}/admin-detail`,
    noFilter: true,
    staleTime: 30 * 1000,
    queryKey: ['admin-user-detail', userId],
    enabled: !!userId,
  });
}

// ==================== SUSPEND USER ====================

/**
 * Hook for suspending a user
 * POST /api/users/:id/suspend
 */
export function useSuspendUser() {
  return useDataMutation<AdminUserRow, SuspendUserRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/suspend`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

// ==================== UNSUSPEND USER ====================

/**
 * Hook for unsuspending a user
 * POST /api/users/:id/unsuspend
 */
export function useUnsuspendUser() {
  return useDataMutation<AdminUserRow, UnsuspendUserRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/unsuspend`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

// ==================== CUSTOMER APPROVAL (User-based endpoints) ====================

/**
 * Hook for approving a customer via user ID
 * POST /api/users/:id/approve-customer
 */
export function useApproveCustomer() {
  return useDataMutation<AdminUserDetail, ApproveCustomerRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/approve-customer`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

/**
 * Hook for rejecting a customer via user ID
 * POST /api/users/:id/reject-customer
 */
export function useRejectCustomer() {
  return useDataMutation<AdminUserDetail, RejectCustomerRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/reject-customer`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

/**
 * Hook for suspending a customer via user ID
 * POST /api/users/:id/suspend-customer
 */
export function useSuspendCustomer() {
  return useDataMutation<AdminUserDetail, SuspendCustomerRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/suspend-customer`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

/**
 * Hook for unsuspending a customer via user ID
 * POST /api/users/:id/unsuspend-customer
 */
export function useUnsuspendCustomer() {
  return useDataMutation<AdminUserDetail, UnsuspendCustomerRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/unsuspend-customer`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

// ==================== DRIVER APPROVAL (User-based endpoints) ====================

/**
 * Hook for approving a driver via user ID
 * POST /api/users/:id/approve-driver
 */
export function useApproveDriver() {
  return useDataMutation<AdminUserDetail, ApproveDriverRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/approve-driver`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

/**
 * Hook for rejecting a driver via user ID
 * POST /api/users/:id/reject-driver
 */
export function useRejectDriver() {
  return useDataMutation<AdminUserDetail, RejectDriverRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/reject-driver`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

/**
 * Hook for suspending a driver via user ID
 * POST /api/users/:id/suspend-driver
 */
export function useSuspendDriver() {
  return useDataMutation<AdminUserDetail, SuspendDriverRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/suspend-driver`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

/**
 * Hook for unsuspending a driver via user ID
 * POST /api/users/:id/unsuspend-driver
 */
export function useUnsuspendDriver() {
  return useDataMutation<AdminUserDetail, UnsuspendDriverRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/unsuspend-driver`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

// ==================== ADMIN UPDATE USER ====================

/**
 * Hook for updating user via admin endpoint
 * PATCH /api/users/:id/admin-update
 */
export function useAdminUpdateUser() {
  return useDataMutation<AdminUserDetail, AdminUpdateUserRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/:id/admin-update`,
    method: 'PATCH',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}

// ==================== CREATE ADMIN USER ====================

/**
 * Hook for creating a new admin user
 * POST /api/users/admin-create
 */
export function useCreateAdminUser() {
  return useDataMutation<CreateAdminUserResponse, CreateAdminUserRequest>({
    apiEndPoint: `${API_BASE_URL}/api/users/admin-create`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary']],
  });
}

// ==================== INVITE DRIVER ====================

/**
 * Hook for inviting a waitlisted driver
 * POST /api/drivers/:id/invite
 */
export function useInviteDriver() {
  return useDataMutation<AdminUserDetail, InviteDriverRequest>({
    apiEndPoint: `${API_BASE_URL}/api/drivers/:id/invite`,
    method: 'POST',
    invalidateQueryKey: [['admin-users'], ['admin-users-summary'], ['admin-user-detail']],
  });
}
