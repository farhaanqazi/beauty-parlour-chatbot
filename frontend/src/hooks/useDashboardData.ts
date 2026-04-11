/**
 * Dashboard Data Hooks
 * 
 * React Query hooks for fetching dashboard data from Supabase via FastAPI backend
 * Follows the same pattern as existing useKpis.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDashboardStats,
  fetchAllAppointments,
  fetchUpcomingAppointments,
  fetchStaffBySalon,
  fetchAppointmentsForRevenue,
  updateAppointmentStatus,
} from '../services/dashboardApi';
import { useAuthStore } from '../store/authStore';

// ============================================================================
// Hook: useAdminDashboardStats
// ============================================================================

/**
 * Fetch system-wide admin dashboard KPIs
 * 
 * @example
 * const { data: stats, isLoading, error } = useAdminDashboardStats();
 */
export const useAdminDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'admin', 'stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};

// ============================================================================
// Hook: useDashboardStats
// ============================================================================

/**
 * Fetch dashboard KPIs (today's bookings, active clients, revenue, etc.)
 * 
 * @example
 * const { data: stats, isLoading, error } = useDashboardStats();
 */
export const useDashboardStats = () => {
  const { user } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  // Use selected salon from localStorage (set by admin salon selection page), fallback to user's salon_id
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;

  return useQuery({
    queryKey: ['dashboard', 'stats', salonId],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
    retry: 2,
    enabled: !!salonId && !!token,
  });
};

// ============================================================================
// Hook: useTodayAppointments
// ============================================================================

/**
 * Fetch today's appointments for the user's salon
 * 
 * @example
 * const { data: appointments, isLoading } = useTodayAppointments();
 */
export const useTodayAppointments = () => {
  const { user } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;

  return useQuery({
    queryKey: ['dashboard', 'appointments', 'today', salonId],
    queryFn: () => salonId ? fetchUpcomingAppointments(salonId, 24) : Promise.resolve([]),
    staleTime: 10000,
    retry: 2,
    enabled: !!salonId && !!token,
  });
};

export const useAllAppointments = () => {
  const { user } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;

  return useQuery({
    queryKey: ['dashboard', 'appointments', 'all', salonId],
    queryFn: () => salonId ? fetchAllAppointments(salonId) : Promise.resolve([]),
    staleTime: 10000,
    retry: 2,
    enabled: !!salonId && !!token,
  });
};

export const useStaffList = () => {
  const { user } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;

  return useQuery({
    queryKey: ['dashboard', 'staff', salonId],
    queryFn: () => salonId ? fetchStaffBySalon(salonId) : Promise.resolve([]),
    staleTime: 60000,
    retry: 2,
    enabled: !!salonId && !!token,
  });
};

// ============================================================================
// Mutation: useUpdateAppointmentStatus
// ============================================================================

/**
 * Creates a mutation for updating an appointment's status.
 * Invalidates the daily appointments query on success to refresh the list.
 * 
 * @example
 * const { mutate: updateStatus } = useUpdateAppointmentStatus();
 * updateStatus({ appointmentId: '123', status: 'confirmed' });
 */
export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: updateAppointmentStatus,
    onSuccess: () => {
      // Invalidate and refetch today's appointments
      queryClient.invalidateQueries({ 
        queryKey: ['dashboard', 'appointments', 'today', user?.salon_id] 
      });
    },
    // Optional: Add onError and onSettled for more robust handling
  });
};

// ============================================================================
// Hook: useWeeklyRevenue
// ============================================================================

/**
 * Calculate weekly revenue from completed appointments
 * 
 * @example
 * const { data: revenue, isLoading } = useWeeklyRevenue();
 */
export const useWeeklyRevenue = () => {
  const { user } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;

  return useQuery({
    queryKey: ['dashboard', 'revenue', 'weekly', salonId],
    queryFn: async () => {
      if (!salonId) return [];

      // Calculate date range (last 7 days)
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const appointments = await fetchAppointmentsForRevenue(
        salonId,
        sevenDaysAgo.toISOString(),
        today.toISOString()
      );

      // Group by day and calculate revenue
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const revenueByDay: Record<string, number> = {};

      // Initialize all days with 0
      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + i);
        const dayKey = days[date.getDay()];
        revenueByDay[dayKey] = 0;
      }

      // Sum revenue per day (using service price)
      appointments.forEach(apt => {
        const date = new Date(apt.appointment_at);
        const dayKey = days[date.getDay()];
        
        // Add service price to revenue
        const price = apt.service?.price || 0;
        revenueByDay[dayKey] = (revenueByDay[dayKey] || 0) + price;
      });

      // Convert to array format for charts
      return Object.entries(revenueByDay).map(([day, value]) => ({
        day,
        value,
      }));
    },
    staleTime: 60000, // 1 minute
    retry: 2,
    enabled: !!salonId && !!token,
  });
};
