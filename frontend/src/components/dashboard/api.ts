import apiClient from '../../services/apiClient';
import type {
  ActiveCustomersResponse,
  KPIData,
  RevenueTrendResponse,
} from './types';

export const dashboardKeys = {
  kpis: ['kpis'] as const,
  weeklyBookings: (kind: 'this' | 'prior', salonId?: string) =>
    ['weekly-bookings', kind, salonId] as const,
  analyticsWeek: (offset: number, salonId?: string) =>
    ['analytics-week', offset, salonId] as const,
  analyticsWeekPrior: (offset: number, salonId?: string) =>
    ['analytics-week', 'prior', offset, salonId] as const,
  activeCustomers: (salonId?: string) =>
    ['active-customers', salonId] as const,
};

export const fetchKPIs = async (): Promise<KPIData> => {
  const { data } = await apiClient.get('/api/v1/analytics/kpis');
  return data;
};

export const fetchTrend = async (
  start: string,
  end: string,
): Promise<RevenueTrendResponse> => {
  const { data } = await apiClient.get<RevenueTrendResponse>(
    '/api/v1/analytics/revenue/trends',
    { params: { start_date: start, end_date: end } },
  );
  return data;
};

export const fetchActiveCustomers = async (
  salonId?: string,
): Promise<ActiveCustomersResponse> => {
  const { data } = await apiClient.get<ActiveCustomersResponse>(
    '/api/v1/customers/active',
    { params: salonId ? { salon_id: salonId } : {} },
  );
  return data;
};
