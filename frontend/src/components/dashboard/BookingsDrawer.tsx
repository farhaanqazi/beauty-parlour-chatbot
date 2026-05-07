import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllAppointments } from '../../services/dashboardApi';
import type { DashboardAppointment } from '../../services/dashboardApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  salonId?: string;
}

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusBadgeClass = (status: string) => {
  const s = status.toLowerCase();
  if (s.startsWith('cancel')) return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
  if (s === 'completed') return 'bg-[var(--color-info)]/15 text-[var(--color-info)]';
  if (s === 'confirmed') return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
  if (s === 'pending') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
  return 'bg-[var(--color-neutral-700)] text-[var(--color-neutral-300)]';
};

const matchesFilter = (status: string, filter: StatusFilter) => {
  if (filter === 'all') return true;
  if (filter === 'cancelled') return status.toLowerCase().startsWith('cancel');
  return status.toLowerCase() === filter;
};

const BookingsDrawer = ({ isOpen, onClose, salonId }: Props) => {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'appointments', 'all', salonId, 'drawer'],
    queryFn: () =>
      salonId ? fetchAllAppointments(salonId) : Promise.resolve([] as DashboardAppointment[]),
    enabled: isOpen && !!salonId,
    staleTime: 30_000,
  });

  const filtered = useMemo(
    () => (data ?? []).filter((a) => matchesFilter(a.status, filter)),
    [data, filter],
  );
  const totalRevenue = useMemo(
    () => filtered.reduce((s, a) => s + (a.final_price ?? 0), 0),
    [filtered],
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--color-surface-raised)] border-l border-[var(--color-neutral-700)] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-neutral-700)]">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-neutral-100)]">
                  Total Bookings
                </h2>
                <p className="text-[var(--color-neutral-400)] text-sm mt-1">
                  All appointments — newest first
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[var(--color-surface-overlay)] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-[var(--color-neutral-400)]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-6 bg-gradient-to-br from-[var(--color-accent)]/15 to-transparent border-b border-[var(--color-neutral-700)]">
              <div>
                <p className="text-[var(--color-neutral-400)] text-xs font-bold uppercase tracking-wide mb-1">
                  Showing
                </p>
                <p className="text-3xl font-bold text-[var(--color-accent)]">{filtered.length}</p>
              </div>
              <div>
                <p className="text-[var(--color-neutral-400)] text-xs font-bold uppercase tracking-wide mb-1">
                  Revenue
                </p>
                <p className="text-3xl font-bold text-[var(--color-success)]">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="px-4 pt-4 pb-3 border-b border-[var(--color-neutral-700)] flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${
                    filter === f
                      ? 'bg-[var(--color-accent)] text-black'
                      : 'bg-[var(--color-surface-base)] text-[var(--color-neutral-400)] border border-[var(--color-neutral-700)] hover:text-[var(--color-neutral-200)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
                </div>
              ) : error ? (
                <p className="text-[var(--color-danger)] text-center py-8 text-sm">
                  Failed to load bookings.
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-[var(--color-neutral-500)] text-center py-8">
                  No bookings match this filter.
                </p>
              ) : (
                filtered.map((apt, i) => {
                  const dt = new Date(apt.appointment_at);
                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-700)] hover:border-[var(--color-accent)]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[var(--color-neutral-100)] font-semibold truncate">
                            {apt.customer_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-[var(--color-neutral-400)] truncate">
                            {apt.service_name || '—'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(
                            apt.status,
                          )}`}
                        >
                          {apt.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="text-[var(--color-neutral-300)]">
                          <span className="font-bold">
                            {dt.toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[var(--color-neutral-500)] ml-2">
                            {dt.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[var(--color-success)]">
                          ₹{(apt.final_price ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      {apt.booking_reference && (
                        <p className="mt-2 text-[10px] text-[var(--color-neutral-600)] font-mono">
                          {apt.booking_reference}
                        </p>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BookingsDrawer;
