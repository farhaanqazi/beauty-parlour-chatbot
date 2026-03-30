import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../services/appointmentService';
import type { AppointmentFilters } from '../types';

export const APPOINTMENT_KEYS = {
  all: ['appointments'] as const,
  list: (filters: AppointmentFilters) => ['appointments', 'list', filters] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
};

export const useAppointments = (filters: AppointmentFilters) =>
  useQuery({
    queryKey: APPOINTMENT_KEYS.list(filters),
    queryFn: () => appointmentService.list(filters),
    staleTime: 30000,
  });

export const useAppointment = (id: string) =>
  useQuery({
    queryKey: APPOINTMENT_KEYS.detail(id),
    queryFn: () => appointmentService.get(id),
    enabled: !!id,
  });

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.all });
    },
  });
};

export const useCancelAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      appointmentService.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.all });
    },
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appointmentService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.all });
    },
  });
};
