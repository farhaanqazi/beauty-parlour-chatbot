/**
 * Booking History Component
 *
 * Displays customer's appointment history timeline
 */

import {
  Calendar,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { CustomerAppointment } from '../../services/customerApi';

// ============================================================================
// Loading Skeleton
// ============================================================================

export const BookingHistorySkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="w-48 h-6 bg-neutral-200 rounded mb-6" />
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="w-12 h-12 bg-neutral-200 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="w-3/4 h-4 bg-neutral-200 rounded" />
            <div className="w-1/2 h-4 bg-neutral-200 rounded" />
            <div className="flex gap-2">
              <div className="w-24 h-6 bg-neutral-200 rounded" />
              <div className="w-20 h-6 bg-neutral-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    confirmed: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2, label: 'Confirmed' },
    pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertCircle, label: 'Pending' },
    completed: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2, label: 'Completed' },
    cancelled_by_client: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
    cancelled_by_salon: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
    cancelled_by_reception: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
    cancelled_by_user: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
    cancelled_closure: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
    no_show: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertCircle, label: 'No Show' },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {config.label}
    </span>
  );
};

// ============================================================================
// Empty State
// ============================================================================

const EmptyBookingHistory = () => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <Calendar className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">No booking history</h3>
    <p className="text-neutral-500 max-w-md">
      This customer hasn't made any appointments yet.
    </p>
  </div>
);

// ============================================================================
// Appointment Item Component
// ============================================================================

interface AppointmentItemProps {
  appointment: CustomerAppointment;
}

const AppointmentItem = ({ appointment }: AppointmentItemProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex gap-4 py-4 px-4 hover:bg-neutral-50 rounded-xl transition-colors group">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500
                     flex items-center justify-center text-white font-semibold
                     shadow-md shadow-blue-500/20 group-hover:shadow-lg group-hover:shadow-blue-500/30 transition-shadow"
          aria-hidden="true"
        >
          {appointment.service_name.charAt(0).toUpperCase()}
        </div>
        <div className="w-0.5 h-full bg-neutral-200 mt-2" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-900 truncate">
              {appointment.service_name}
            </h4>
            <p className="text-sm text-neutral-500">
              Ref: {appointment.booking_reference}
            </p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-neutral-400" strokeWidth={2} aria-hidden="true" />
            <span>{formatDate(appointment.appointment_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-neutral-400" strokeWidth={2} aria-hidden="true" />
            <span>{formatTime(appointment.appointment_at)}</span>
          </div>
        </div>

        {/* Notes (if any) */}
        {appointment.notes && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <span className="font-medium">Notes:</span> {appointment.notes}
            </p>
          </div>
        )}

        {/* Cancellation reason (if cancelled) */}
        {appointment.cancellation_reason && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <p className="text-sm text-rose-900">
              <span className="font-medium">Cancellation reason:</span> {appointment.cancellation_reason}
            </p>
          </div>
        )}

        {/* Timestamps */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
          <span>
            <span className="font-medium">Booked:</span> {appointment.created_at ? formatDateTime(appointment.created_at) : 'N/A'}
          </span>
          {appointment.confirmed_at && (
            <span>
              <span className="font-medium">Confirmed:</span> {formatDateTime(appointment.confirmed_at)}
            </span>
          )}
          {appointment.cancelled_at && (
            <span>
              <span className="font-medium">Cancelled:</span> {formatDateTime(appointment.cancelled_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface BookingHistoryProps {
  appointments: CustomerAppointment[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const BookingHistory = ({
  appointments,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading = false,
}: BookingHistoryProps) => {
  const totalPages = Math.ceil(total / pageSize);

  const handlePrevious = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  if (isLoading) {
    return <BookingHistorySkeleton />;
  }

  if (!appointments || appointments.length === 0) {
    return <EmptyBookingHistory />;
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Booking History</h3>
          <p className="text-sm text-neutral-500 mt-0.5">
            {total} {total === 1 ? 'appointment' : 'appointments'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {appointments.map((appointment) => (
          <AppointmentItem key={appointment.id} appointment={appointment} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-200">
          <button
            onClick={handlePrevious}
            disabled={page <= 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700
                     bg-white border border-neutral-300 rounded-lg
                     hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            Previous
          </button>

          <span className="text-sm text-neutral-600 font-medium">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={page >= totalPages}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700
                     bg-white border border-neutral-300 rounded-lg
                     hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
            aria-label="Next page"
          >
            Next
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
};
