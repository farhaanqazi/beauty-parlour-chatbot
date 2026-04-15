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
  final_price?: number;
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
    final_price: apt.final_price,
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
 * Fetch completed appointments for revenue calculation.
 * Uses the salon-specific endpoint (accessible to all roles) and filters client-side.
 */
export const fetchAppointmentsForRevenue = async (
  salonId: string,
  fromDate: string,
  toDate: string
): Promise<DashboardAppointment[]> => {
  const { data } = await apiClient.get<{ appointments: any[] }>(`/api/v1/salons/${salonId}/appointments/all`);

  const from = new Date(fromDate);
  const to = new Date(toDate);

  // Count revenue from completed OR confirmed appointments (appointments are rarely
  // explicitly marked 'completed' — confirmed past appointments represent real revenue too)
  const revenueStatuses = new Set(['completed', 'confirmed']);

  console.log('[Revenue] Total appointments from API:', data.appointments.length);
  console.log('[Revenue] Date window:', fromDate, '→', toDate);
  console.log('[Revenue] Sample (first 5):', data.appointments.slice(0, 5).map((a: any) => ({
    date: a.appointment_at, status: a.status, price: a.final_price
  })));

  return data.appointments
    .filter((apt: any) => {
      const aptDate = new Date(apt.appointment_at);
      return revenueStatuses.has(apt.status) && aptDate >= from && aptDate <= to;
    })
    .map((apt: any) => ({
      id: apt.id,
      customer_name: apt.customer_name || 'Unknown',
      service_name: apt.service_name || 'Unknown Service',
      staff_name: null,
      appointment_at: apt.appointment_at,
      status: apt.status,
      phone_number: null,
      final_price: apt.final_price || 0,
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
