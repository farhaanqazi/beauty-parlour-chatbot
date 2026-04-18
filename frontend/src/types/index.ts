export type UserRole = 'admin' | 'salon_owner' | 'reception';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  salon_id: string | null;
  is_active: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Appointment Module Types
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'cancelled_by_client'
  | 'cancelled_by_user'
  | 'cancelled_by_salon'
  | 'cancelled_by_reception'
  | 'cancelled_closure'
  | 'completed'
  | 'no_show';

export interface CustomerSummary {
  id: string;
  name: string;
  phone_number: string;
  channel: string;
  display_name?: string;
}

export interface ServiceSummary {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
}

export interface Appointment {
  id: string;
  salon_id: string;
  customer_id: string;
  service_id: string;
  booking_reference: string;
  appointment_at: string;
  status: AppointmentStatus;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  customer: CustomerSummary;
  service: ServiceSummary;
  final_price?: number;
}

export interface AppointmentStatusLog {
  old_status: AppointmentStatus | null;
  new_status: AppointmentStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface AppointmentDetail extends Appointment {
  status_log: AppointmentStatusLog[];
}

export interface AppointmentListResponse {
  data: Appointment[];
  total: number;
  page: number;
  page_size: number;
}

export interface AppointmentFilters {
  salon_id?: string;
  status?: AppointmentStatus | '';
  date_from?: string;
  date_to?: string;
  search?: string;
  page: number;
  page_size: number;
}
