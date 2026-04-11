/**
 * Dashboard Data API Service
 *
 * Fetches real-time data from Supabase via FastAPI backend
 * Mirrors the patterns from existing useKpis.ts
 */

import apiClient from '../services/apiClient';

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  total_salons: number;
  total_users: number;
  todays_appointments: number;
  pending_appointments: number;
  confirmed_appointments: number;
  completed_appointments: number;
  no_shows: number;
}

export interface DashboardAppointment {
  id: string;
  customer_name: string;
  service_name: string;
  staff_name: string | null;
  appointment_at: string;
  status: string;
  phone_number: string | null;
  service?: {
    price: number;
  };
}

export interface StaffMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'admin' | 'salon_owner' | 'reception';
  is_active: boolean;
}

export interface WeeklyRevenue {
  day: string;
  value: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch dashboard KPIs
 * Uses existing backend endpoint /api/v1/analytics/kpis
 */
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data } = await apiClient.get<DashboardStats>('/api/v1/analytics/kpis');
  return data;
};

/**
 * Fetch upcoming appointments for a salon
 * MATCHES: @router.get("/salons/{salon_slug}/appointments/upcoming")
 */
export const fetchAllAppointments = async (salonId: string): Promise<DashboardAppointment[]> => {
  const { data } = await apiClient.get<any>(`/api/v1/salons/${salonId}/appointments/all`);
  return data.appointments || [];
};

export const fetchUpcomingAppointments = async (salonSlug: string, hours: number = 24): Promise<DashboardAppointment[]> => {
  const { data } = await apiClient.get(`/api/v1/salons/${salonSlug}/appointments/upcoming`, {
    params: { hours },
  });

  // Backend returns: { salon: string, appointments: [...] }
  return data.appointments.map((apt: any) => ({
    id: apt.id,
    customer_name: apt.customer || 'Unknown',
    service_name: apt.service || 'Unknown Service',
    staff_name: null,
    appointment_at: apt.appointment_at,
    status: apt.status,
    phone_number: null,
  }));
};


/**
 * Update an appointment's status
 * MATCHES: (assumed) @router.patch("/appointments/{appointment_id}/status")
 */
export const updateAppointmentStatus = async ({ appointmentId, status }: { appointmentId: string; status: string; }): Promise<any> => {
  const { data } = await apiClient.patch(`/api/v1/appointments/${appointmentId}/status`, {
    status,
  });
  return data;
};

/**
 * Cancel an appointment
 * MATCHES: @router.post("/appointments/{appointment_id}/cancel")
 */
export const cancelAppointment = async (appointmentId: string, reason: string, cancelled_by: string = 'customer'): Promise<any> => {
  const { data } = await apiClient.post(`/api/v1/appointments/${appointmentId}/cancel`, {
    reason,
    cancelled_by,
  });
  return data;
};

/**
 * Fetch staff members for a salon
 */
export const fetchStaffBySalon = async (salonId: string): Promise<StaffMember[]> => {
  const { data } = await apiClient.get<{ data: StaffMember[] }>('/api/v1/users', {
    params: { salon_id: salonId },
  });
  return data.data;
};

/**
 * Fetch all appointments for revenue calculation
 * Uses GET /salons/{salon_id} endpoint and filters completed appointments
 */
export const fetchAppointmentsForRevenue = async (
  salonId: string,
  fromDate: string,
  toDate: string
): Promise<DashboardAppointment[]> => {
  // Note: Backend doesn't have a dedicated revenue endpoint yet
  // This uses the general appointments list and filters client-side
  const { data } = await apiClient.get<{ data: any[] }>('/api/v1/appointments', {
    params: {
      salon_id: salonId,
      date_from: fromDate,
      date_to: toDate,
      status: 'completed',
    },
  });
  
  // Transform to DashboardAppointment format
  return data.data.map((apt: any) => ({
    id: apt.id,
    customer_name: apt.customer?.display_name || apt.customer?.phone_number || 'Unknown',
    service_name: apt.service?.name || 'Unknown Service',
    staff_name: null,
    appointment_at: apt.appointment_at,
    status: apt.status,
    phone_number: apt.customer?.phone_number || null,
  }));
};

export interface DashboardSalonService {
  id: string;
  name: string;
  duration_minutes: number;
}

export const fetchSalonServices = async (salonId: string): Promise<DashboardSalonService[]> => {
  const { data } = await apiClient.get<any>(`/api/v1/salons/${salonId}`);
  return data.services || [];
};
