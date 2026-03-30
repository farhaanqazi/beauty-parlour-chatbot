/**
 * Analytics Hooks
 *
 * React Query hooks for fetching analytics data
 */

import { useQuery } from '@tanstack/react-query';
import * as analyticsApi from '../services/analyticsApi';

// ============================================================================
// Hook: useRevenueTrends
// ============================================================================

/**
 * Fetch revenue trends over time
 *
 * @example
 * const { data: revenueTrends, isLoading } = useRevenueTrends(30);
 */
export const useRevenueTrends = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'revenue', 'trends', days],
    queryFn: () => analyticsApi.getRevenueTrends(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useRevenueByService
// ============================================================================

/**
 * Fetch revenue breakdown by service
 *
 * @example
 * const { data: revenueByService, isLoading } = useRevenueByService(30);
 */
export const useRevenueByService = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'revenue', 'by-service', days],
    queryFn: () => analyticsApi.getRevenueByService(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useAppointmentsByDayOfWeek
// ============================================================================

/**
 * Fetch appointments by day of week
 *
 * @example
 * const { data: appointmentsByDay, isLoading } = useAppointmentsByDayOfWeek(90);
 */
export const useAppointmentsByDayOfWeek = (days: number = 90) => {
  return useQuery({
    queryKey: ['analytics', 'appointments', 'by-day', days],
    queryFn: () => analyticsApi.getAppointmentsByDayOfWeek(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useAppointmentsByHour
// ============================================================================

/**
 * Fetch appointments by hour of day
 *
 * @example
 * const { data: appointmentsByHour, isLoading } = useAppointmentsByHour(30);
 */
export const useAppointmentsByHour = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'appointments', 'by-hour', days],
    queryFn: () => analyticsApi.getAppointmentsByHour(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useStatusBreakdown
// ============================================================================

/**
 * Fetch appointment status breakdown
 *
 * @example
 * const { data: statusBreakdown, isLoading } = useStatusBreakdown(30);
 */
export const useStatusBreakdown = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'appointments', 'status', days],
    queryFn: () => analyticsApi.getStatusBreakdown(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useCancellationRate
// ============================================================================

/**
 * Fetch cancellation rate analytics
 *
 * @example
 * const { data: cancellationRate, isLoading } = useCancellationRate(30);
 */
export const useCancellationRate = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'appointments', 'cancellation', days],
    queryFn: () => analyticsApi.getCancellationRate(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useStaffUtilization
// ============================================================================

/**
 * Fetch staff utilization metrics
 *
 * @example
 * const { data: staffUtilization, isLoading } = useStaffUtilization(30);
 */
export const useStaffUtilization = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'staff', 'utilization', days],
    queryFn: () => analyticsApi.getStaffUtilization(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useNewVsRepeatCustomers
// ============================================================================

/**
 * Fetch new vs repeat customer analytics
 *
 * @example
 * const { data: newVsRepeat, isLoading } = useNewVsRepeatCustomers(30);
 */
export const useNewVsRepeatCustomers = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'customers', 'new-vs-repeat', days],
    queryFn: () => analyticsApi.getNewVsRepeatCustomers(days),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useLifetimeValueDistribution
// ============================================================================

/**
 * Fetch customer lifetime value distribution
 *
 * @example
 * const { data: ltvDistribution, isLoading } = useLifetimeValueDistribution();
 */
export const useLifetimeValueDistribution = () => {
  return useQuery({
    queryKey: ['analytics', 'customers', 'ltv-distribution'],
    queryFn: analyticsApi.getLifetimeValueDistribution,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};
