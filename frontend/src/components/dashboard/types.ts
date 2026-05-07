import type { ReactNode } from 'react';

export interface KPICardData {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down';
  icon: ReactNode;
  color: 'accent' | 'success' | 'info' | 'warning';
  action?: ReactNode;
  changeUnit?: string;
  since?: string;
}

export interface RevenueByService {
  service: string;
  count: number;
  revenue: number;
}

export interface KPIData {
  total_revenue: number;
  total_appointments: number;
  todays_appointments: number;
  unique_customers: number;
  revenue_by_service: RevenueByService[];
}

export interface DailyTrendPoint {
  date: string;
  revenue: number;
  appointment_count: number;
}

export interface RevenueTrendResponse {
  data: DailyTrendPoint[];
}

export interface ActiveCustomer {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  email: string | null;
  channel: string;
  created_at: string | null;
  total_visits: number;
  total_spent: number;
  last_visit: string | null;
}

export interface ActiveCustomersResponse {
  data: ActiveCustomer[];
  total: number;
}
