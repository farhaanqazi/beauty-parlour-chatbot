/**
 * Customer API Service
 *
 * Fetches customer data from FastAPI backend
 */

import apiClient from './apiClient';

// ============================================================================
// Types
// ============================================================================

export interface CustomerMetrics {
  total_visits: number;
  total_spent: number;
  last_visit: string | null;
  favorite_services: { service: string; count: number }[];
}

export interface Customer {
  id: string;
  salon_id: string;
  display_name: string | null;
  phone_number: string | null;
  telegram_chat_id: string | null;
  channel: string;
  preferred_language: string | null;
  external_user_id: string;
  created_at: string | null;
  metrics: CustomerMetrics;
}

export interface CustomerAppointment {
  id: string;
  booking_reference: string;
  status: string;
  service_name: string;
  appointment_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface CustomerAppointmentsResponse {
  data: CustomerAppointment[];
  total: number;
  page: number;
  page_size: number;
}

export interface CustomerListResponse {
  data: Array<{
    id: string;
    display_name: string | null;
    phone_number: string | null;
    channel: string;
    created_at: string | null;
  }>;
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get customer profile by ID
 */
export const getCustomer = async (customerId: string): Promise<Customer> => {
  const { data } = await apiClient.get<Customer>(`/api/v1/customers/${customerId}`);
  return data;
};

/**
 * Get customer's appointment history
 */
export const getCustomerAppointments = async (
  customerId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CustomerAppointmentsResponse> => {
  const { data } = await apiClient.get<CustomerAppointmentsResponse>(
    `/api/v1/customers/${customerId}/appointments`,
    {
      params: { limit, offset },
    }
  );
  return data;
};

/**
 * List customers with optional filtering
 */
export const listCustomers = async (
  salonId?: string,
  search?: string,
  limit: number = 50,
  offset: number = 0
): Promise<CustomerListResponse> => {
  const { data } = await apiClient.get<CustomerListResponse>('/api/v1/customers', {
    params: { salon_id: salonId, search, limit, offset },
  });
  return data;
};
