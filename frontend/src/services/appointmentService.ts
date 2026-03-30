import apiClient from './apiClient';
import type {
  Appointment,
  AppointmentDetail,
  AppointmentListResponse,
  AppointmentFilters,
} from '../types';

export const appointmentService = {
  list: async (filters: AppointmentFilters): Promise<AppointmentListResponse> => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined)
    );
    const { data } = await apiClient.get('/api/v1/appointments', { params });
    return data;
  },

  get: async (id: string): Promise<AppointmentDetail> => {
    const { data } = await apiClient.get(`/api/v1/appointments/${id}`);
    return data;
  },

  updateStatus: async (id: string, status: string): Promise<Appointment> => {
    const { data } = await apiClient.patch(`/api/v1/appointments/${id}`, { status });
    return data;
  },

  cancel: async (id: string, reason: string): Promise<Appointment> => {
    const { data } = await apiClient.post(`/api/v1/appointments/${id}/cancel`, { reason });
    return data;
  },

  create: async (payload: {
    salon_id: string;
    customer_id: string;
    service_id: string;
    appointment_at: string;
    notes?: string;
  }): Promise<Appointment> => {
    const { data } = await apiClient.post('/api/v1/appointments', payload);
    return data;
  },
};
