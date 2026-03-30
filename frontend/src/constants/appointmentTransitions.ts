import type { AppointmentStatus } from '../types';

export const ALLOWED_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  pending: ['confirmed', 'no_show'],
  confirmed: ['completed', 'no_show'],
};

export const TERMINAL_STATUSES: AppointmentStatus[] = [
  'cancelled_by_client',
  'cancelled_by_salon',
  'cancelled_by_reception',
  'cancelled_closure',
  'completed',
  'no_show',
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled_by_client: 'Cancelled by Client',
  cancelled_by_salon: 'Cancelled by Salon',
  cancelled_by_reception: 'Cancelled by Reception',
  cancelled_closure: 'Cancelled — Closure',
  cancelled_by_user: 'Cancelled by User',
  completed: 'Completed',
  no_show: 'No Show',
};

export const isTerminal = (status: AppointmentStatus): boolean =>
  TERMINAL_STATUSES.includes(status);

export const getAllowedTransitions = (status: AppointmentStatus): AppointmentStatus[] =>
  ALLOWED_TRANSITIONS[status] ?? [];
