import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, User, Phone, Clock, Hash, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomer, useCustomerAppointments } from '../../hooks/useCustomerDetails';
import { useUpdateAppointmentStatus } from '../../hooks/useDashboardData';

interface AppointmentDrawerProps {
  appointment: {
    id: string;
    booking_reference: string;
    service: string;
    customer: string;
    customer_id?: string;
    appointment_at: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    final_price?: number;
  } | null;
  onClose: () => void;
}

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled'] as const;

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 border border-green-300',
  pending: 'bg-amber-100 text-amber-800 border border-amber-300',
  completed: 'bg-blue-100 text-blue-800 border border-blue-300',
  cancelled: 'bg-red-100 text-red-800 border border-red-300',
};

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

export default function AppointmentDrawer({ appointment, onClose }: AppointmentDrawerProps) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);

  const { data: customer, isLoading: customerLoading } = useCustomer(
    appointment?.customer_id
  );
  const { data: historyData, isLoading: historyLoading } = useCustomerAppointments(
    appointment?.customer_id,
    5,
    0
  );
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateAppointmentStatus();

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Trap focus
  useEffect(() => {
    if (appointment) {
      drawerRef.current?.focus();
    }
  }, [appointment]);

  return (
    <AnimatePresence>
      {appointment && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Appointment details"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl flex flex-col outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wide">
                    Booking Reference
                  </p>
                  <p className="text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {appointment.booking_reference}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5 text-neutral-500" strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Service & Date */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                  Appointment
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-500">Service</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {appointment.service || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-500">Date & Time</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {formatDateTime(appointment.appointment_at)}
                      </p>
                    </div>
                  </div>
                  {appointment.final_price !== undefined && (
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 text-neutral-400 shrink-0 text-center text-xs font-bold">₹</span>
                      <div>
                        <p className="text-xs text-neutral-500">Price</p>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          ₹{appointment.final_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Status */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                  Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      disabled={updatingStatus || appointment.status === s}
                      onClick={() =>
                        updateStatus({ appointmentId: appointment.id, status: s })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        appointment.status === s
                          ? STATUS_STYLES[s] + ' ring-2 ring-offset-1 ring-blue-400'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300 dark:border-white/10 dark:hover:bg-white/10'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </section>

              {/* Customer Info */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                  Customer
                </h3>
                {customerLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-neutral-200 rounded w-3/4" />
                    <div className="h-3 bg-neutral-200 rounded w-1/2" />
                  </div>
                ) : customer ? (
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div>
                          <p className="text-xs text-neutral-500">Name</p>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {customer.display_name || appointment.customer || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      {customer.phone_number && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                          <div>
                            <p className="text-xs text-neutral-500">Phone</p>
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {customer.phone_number}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="w-4 h-4 text-neutral-400 shrink-0 text-xs font-bold flex items-center justify-center">
                          {customer.channel?.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-xs text-neutral-500">Channel</p>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 capitalize">
                            {customer.channel}
                          </p>
                        </div>
                      </div>
                    </div>
                    {appointment.customer_id && (
                      <button
                        onClick={() => navigate(`/customers/${appointment.customer_id}`)}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Full profile
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {appointment.customer || 'Unknown'}
                    </p>
                    <p className="text-xs text-neutral-500">No profile linked</p>
                  </div>
                )}
              </section>

              {/* Past Appointments */}
              {appointment.customer_id && (
                <section>
                  <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                    Recent Visits
                  </h3>
                  {historyLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 bg-neutral-200 rounded" />
                      ))}
                    </div>
                  ) : historyData && historyData.data.length > 0 ? (
                    <div className="space-y-2">
                      {historyData.data.map((past) => (
                        <div
                          key={past.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                            past.id === appointment.id
                              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                              : 'bg-neutral-50 border-neutral-200 dark:bg-white/5 dark:border-white/10'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-neutral-100 text-xs">
                              {past.service_name}
                            </p>
                            <p className="text-xs text-neutral-500">{formatDate(past.appointment_at)}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              STATUS_STYLES[past.status] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {past.status.charAt(0).toUpperCase() + past.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No previous visits</p>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            {appointment.customer_id && (
              <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10">
                <button
                  onClick={() =>
                    navigate(`/owner/appointments?customer_id=${appointment.customer_id}`)
                  }
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  New Booking for This Customer
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
