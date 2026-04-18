import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, MessageCircle, Calendar, Star, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomer, useCustomerAppointments } from '../../hooks/useCustomerDetails';
import { useUpdateAppointmentStatus } from '../../hooks/useDashboardData';

interface CustomerDrawerProps {
  customerId: string | null;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 border border-green-300',
  pending: 'bg-amber-100 text-amber-800 border border-amber-300',
  completed: 'bg-blue-100 text-blue-800 border border-blue-300',
  cancelled: 'bg-red-100 text-red-800 border border-red-300',
};

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled'] as const;

const formatDate = (dateStr: string | null) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '—';

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function CustomerDrawer({ customerId, onClose }: CustomerDrawerProps) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId ?? undefined);
  const { data: historyData, isLoading: historyLoading } = useCustomerAppointments(
    customerId ?? undefined,
    20,
    0
  );
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateAppointmentStatus();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (customerId) drawerRef.current?.focus();
  }, [customerId]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AnimatePresence>
      {customerId && (
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
            aria-label="Customer details"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl flex flex-col outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                {customerLoading ? (
                  <div className="w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(customer?.display_name ?? null)}
                  </div>
                )}
                <div>
                  {customerLoading ? (
                    <div className="w-32 h-4 bg-neutral-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      {customer?.display_name || 'Unnamed Customer'}
                    </p>
                  )}
                  <p className="text-xs text-neutral-500">Customer Profile</p>
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
              {customerLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-neutral-200 rounded" />
                  ))}
                </div>
              ) : customer ? (
                <>
                  {/* Contact Info */}
                  <section>
                    <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                      Contact
                    </h3>
                    <div className="space-y-3">
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
                        <MessageCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div>
                          <p className="text-xs text-neutral-500">Channel</p>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 capitalize">
                            {customer.channel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div>
                          <p className="text-xs text-neutral-500">Customer Since</p>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {formatDate(customer.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Metrics */}
                  <section>
                    <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                      Lifetime Stats
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                          {customer.metrics.total_visits}
                        </p>
                        <p className="text-xs text-neutral-500">Visits</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-green-700 dark:text-green-400">
                          ₹{customer.metrics.total_spent.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-neutral-500">Spent</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          {formatDate(customer.metrics.last_visit)}
                        </p>
                        <p className="text-xs text-neutral-500">Last Visit</p>
                      </div>
                    </div>
                  </section>

                  {/* Favorite Services */}
                  {customer.metrics.favorite_services?.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                        Favourite Services
                      </h3>
                      <div className="space-y-1.5">
                        {customer.metrics.favorite_services.slice(0, 3).map((fav, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-white/5 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Star className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-neutral-800 dark:text-neutral-200">{fav.service}</span>
                            </div>
                            <span className="text-xs text-neutral-500">{fav.count}×</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-500">Customer not found</p>
              )}

              {/* Appointment History */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Appointment History
                  </h3>
                  {customer && (
                    <button
                      onClick={() => navigate(`/customers/${customerId}`)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      Full profile <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {historyLoading ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-neutral-200 rounded" />
                    ))}
                  </div>
                ) : historyData && historyData.data.length > 0 ? (
                  <div className="space-y-2">
                    {historyData.data.map((apt) => (
                      <div
                        key={apt.id}
                        className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                              {apt.service_name}
                            </p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {formatDateTime(apt.appointment_at)}
                            </p>
                          </div>
                          <select
                            value={apt.status}
                            disabled={updatingStatus}
                            onChange={(e) =>
                              updateStatus({
                                appointmentId: apt.id,
                                status: e.target.value as any,
                              })
                            }
                            className={`text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${
                              STATUS_STYLES[apt.status] || 'bg-gray-100 text-gray-800'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs font-mono text-neutral-400 mt-1">{apt.booking_reference}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No appointment history</p>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 space-y-2">
              <button
                onClick={() =>
                  navigate(`/owner/appointments?customer_id=${customerId}`)
                }
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                New Booking
              </button>
              {customerId && (
                <button
                  onClick={() => navigate(`/customers/${customerId}`)}
                  className="w-full py-2 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  View Full Profile
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
