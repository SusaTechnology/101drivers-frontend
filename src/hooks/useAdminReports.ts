// Hooks for admin reports API
import { useDataQuery, getAccessToken } from '@/lib/tanstack/dataQuery';
import type {
  DeliveriesReportResponse,
  DeliveriesReportParams,
  ComplianceReportResponse,
  ComplianceReportParams,
  DisputesReportResponse,
  DisputesReportParams,
  PaymentsReportResponse,
  PaymentsReportParams,
  PayoutsReportResponse,
  PayoutsReportParams,
  InsuranceMileageReportResponse,
  InsuranceMileageReportParams,
} from '@/types/report';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from params
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'boolean') {
        searchParams.set(key, value ? 'true' : 'false');
      } else {
        searchParams.set(key, String(value));
      }
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ==================== DELIVERIES REPORT ====================

export function useDeliveriesReport(params: DeliveriesReportParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<DeliveriesReportResponse>({
    apiEndPoint: `${API_BASE_URL}/api/reports/deliveries${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000, // 1 minute
    queryKey: ['report-deliveries', paramsKey],
  });
}

// ==================== COMPLIANCE REPORT ====================

export function useComplianceReport(params: ComplianceReportParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<ComplianceReportResponse>({
    apiEndPoint: `${API_BASE_URL}/api/reports/compliance${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['report-compliance', paramsKey],
  });
}

// ==================== DISPUTES REPORT ====================

export function useDisputesReport(params: DisputesReportParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<DisputesReportResponse>({
    apiEndPoint: `${API_BASE_URL}/api/reports/disputes${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['report-disputes', paramsKey],
  });
}

// ==================== PAYMENTS REPORT ====================

export function usePaymentsReport(params: PaymentsReportParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<PaymentsReportResponse>({
    apiEndPoint: `${API_BASE_URL}/api/reports/payments${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['report-payments', paramsKey],
  });
}

// ==================== PAYOUTS REPORT ====================

export function usePayoutsReport(params: PayoutsReportParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<PayoutsReportResponse>({
    apiEndPoint: `${API_BASE_URL}/api/reports/payouts${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['report-payouts', paramsKey],
  });
}

// ==================== INSURANCE MILEAGE REPORT ====================

export function useInsuranceMileageReport(params: InsuranceMileageReportParams = {}) {
  const queryString = buildQueryString(params);
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<InsuranceMileageReportResponse>({
    apiEndPoint: `${API_BASE_URL}/api/reports/insurance-mileage${queryString}`,
    noFilter: true,
    staleTime: 60 * 1000,
    queryKey: ['report-insurance-mileage', paramsKey],
  });
}

// ==================== EXPORT HELPERS ====================

export function getReportExportUrl(reportType: string, params: Record<string, unknown>, format: string): string {
  const exportParams = { ...params, format };
  const queryString = buildQueryString(exportParams);
  return `${API_BASE_URL}/api/reports/${reportType}${queryString}`;
}

/**
 * Download report file - fetches with credentials and triggers browser download
 */
export async function downloadReport(reportType: string, params: Record<string, unknown>, format: string): Promise<void> {
  const url = getReportExportUrl(reportType, params, format);
  
  // Get the access token for authentication
  const token = getAccessToken();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Include cookies for auth
      headers: {
        'Accept': format === 'pdf' ? 'application/pdf' : 
                  format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
                  'text/csv',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    // Get the blob from response
    const blob = await response.blob();
    
    // Extract filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `${reportType}-report.${format}`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    // Create download link and trigger download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Report download failed:', error);
    throw error;
  }
}

// ==================== FORMAT HELPERS ====================

export function formatReportDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatReportDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatReportCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toFixed(2)}`;
}

export function formatReportMiles(miles: number | null | undefined): string {
  if (miles === null || miles === undefined) return '—';
  return `${miles.toFixed(1)} mi`;
}

export function formatReportPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}
