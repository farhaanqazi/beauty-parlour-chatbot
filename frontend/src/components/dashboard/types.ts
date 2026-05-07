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
