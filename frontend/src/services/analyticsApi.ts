/**
 * Analytics API Service
 *
 * Fetches analytics data from FastAPI backend
 */

import apiClient from './apiClient';

// ============================================================================
// Types
// ============================================================================

export interface RevenueTrendData {
  date: string;
  revenue: number;
  appointment_count: number;
}

export interface RevenueTrendsResponse {
  data: RevenueTrendData[];
  total_revenue: number;
  total_appointments: number;
}

export interface RevenueByServiceData {
  service: string;
  count: number;
  revenue: number;
}

export interface RevenueByServiceResponse {
  data: RevenueByServiceData[];
}

export interface DayOfWeekData {
  day: string;
  count: number;
}

export interface AppointmentsByDayResponse {
  data: DayOfWeekData[];
}

export interface HourData {
  hour: number;
  count: number;
}

export interface AppointmentsByHourResponse {
  data: HourData[];
}

export interface StatusBreakdownData {
  status: string;
  count: number;
}

export interface StatusBreakdownResponse {
  data: StatusBreakdownData[];
}

export interface CancellationRateResponse {
  total_appointments: number;
  cancelled: number;
  no_shows: number;
  cancellation_rate: number;
  no_show_rate: number;
}

export interface StaffUtilizationData {
  user_id: string;
  name: string;
  appointment_count: number;
  revenue_generated: number;
}

export interface StaffUtilizationResponse {
  data: StaffUtilizationData[];
}

export interface NewVsRepeatCustomersResponse {
  new_customers: number;
  repeat_customers: number;
}

export interface LifetimeValueData {
  range: string;
  count: number;
}

export interface LifetimeValueDistributionResponse {
  data: LifetimeValueData[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get revenue trends over time
 */
export const getRevenueTrends = async (days: number = 30): Promise<RevenueTrendsResponse> => {
  const { data } = await apiClient.get<RevenueTrendsResponse>('/api/v1/analytics/revenue/trends', {
    params: { days },
  });
  return data;
};

/**
 * Get revenue breakdown by service
 */
export const getRevenueByService = async (days: number = 30): Promise<RevenueByServiceResponse> => {
  const { data } = await apiClient.get<RevenueByServiceResponse>('/api/v1/analytics/revenue/by-service', {
    params: { days },
  });
  return data;
};

/**
 * Get appointments by day of week
 */
export const getAppointmentsByDayOfWeek = async (days: number = 90): Promise<AppointmentsByDayResponse> => {
  const { data } = await apiClient.get<AppointmentsByDayResponse>('/api/v1/analytics/appointments/by-day-of-week', {
    params: { days },
  });
  return data;
};

/**
 * Get appointments by hour of day
 */
export const getAppointmentsByHour = async (days: number = 30): Promise<AppointmentsByHourResponse> => {
  const { data } = await apiClient.get<AppointmentsByHourResponse>('/api/v1/analytics/appointments/by-hour', {
    params: { days },
  });
  return data;
};

/**
 * Get appointment status breakdown
 */
export const getStatusBreakdown = async (days: number = 30): Promise<StatusBreakdownResponse> => {
  const { data } = await apiClient.get<StatusBreakdownResponse>('/api/v1/analytics/appointments/status-breakdown', {
    params: { days },
  });
  return data;
};

/**
 * Get cancellation rate analytics
 */
export const getCancellationRate = async (days: number = 30): Promise<CancellationRateResponse> => {
  const { data } = await apiClient.get<CancellationRateResponse>('/api/v1/analytics/appointments/cancellation-rate', {
    params: { days },
  });
  return data;
};

/**
 * Get staff utilization metrics
 */
export const getStaffUtilization = async (days: number = 30): Promise<StaffUtilizationResponse> => {
  const { data } = await apiClient.get<StaffUtilizationResponse>('/api/v1/analytics/staff/utilization', {
    params: { days },
  });
  return data;
};

/**
 * Get new vs repeat customer analytics
 */
export const getNewVsRepeatCustomers = async (days: number = 30): Promise<NewVsRepeatCustomersResponse> => {
  const { data } = await apiClient.get<NewVsRepeatCustomersResponse>('/api/v1/analytics/customers/new-vs-repeat', {
    params: { days },
  });
  return data;
};

/**
 * Get customer lifetime value distribution
 */
export const getLifetimeValueDistribution = async (): Promise<LifetimeValueDistributionResponse> => {
  const { data } = await apiClient.get<LifetimeValueDistributionResponse>('/api/v1/analytics/customers/lifetime-value-distribution');
  return data;
};
