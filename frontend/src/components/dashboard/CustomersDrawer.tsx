import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Phone, Mail, Calendar as CalendarIcon } from 'lucide-react';
import { useActiveCustomers } from './hooks/useActiveCustomers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  salonId?: string;
}

const formatRelative = (iso: string | null) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const channelBadgeClass = (channel: string) => {
  const c = channel.toLowerCase();
  if (c.includes('telegram')) return 'bg-[var(--color-info)]/15 text-[var(--color-info)]';
  if (c.includes('whatsapp')) return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
  return 'bg-[var(--color-neutral-700)] text-[var(--color-neutral-300)]';
};

const CustomersDrawer = ({ isOpen, onClose, salonId }: Props) => {
  const { data, isLoading, error } = useActiveCustomers({ enabled: isOpen, salonId });

  if (!isOpen) return null;

  const customers = data?.data ?? [];
  const totalSpent = customers.reduce((s, c) => s + (c.total_spent || 0), 0);

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
                  Active Customers
                </h2>
                <p className="text-[var(--color-neutral-400)] text-sm mt-1">
                  Customers with at least one booking
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

            <div className="grid grid-cols-2 gap-3 p-6 bg-gradient-to-br from-[var(--color-warning)]/15 to-transparent border-b border-[var(--color-neutral-700)]">
              <div>
                <p className="text-[var(--color-neutral-400)] text-xs font-bold uppercase tracking-wide mb-1">
                  Total
                </p>
                <p className="text-3xl font-bold text-[var(--color-warning)]">
                  {customers.length}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-neutral-400)] text-xs font-bold uppercase tracking-wide mb-1">
                  Lifetime Spend
                </p>
                <p className="text-3xl font-bold text-[var(--color-success)]">
                  ₹{totalSpent.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
                </div>
              ) : error ? (
                <p className="text-[var(--color-danger)] text-center py-8 text-sm">
                  Failed to load customers.
                </p>
              ) : customers.length === 0 ? (
                <p className="text-[var(--color-neutral-500)] text-center py-8">
                  No active customers yet.
                </p>
              ) : (
                customers.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-700)] hover:border-[var(--color-accent)]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--color-neutral-100)] font-semibold truncate">
                          {c.display_name || 'Unnamed Customer'}
                        </p>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${channelBadgeClass(
                            c.channel,
                          )}`}
                        >
                          {c.channel}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-[var(--color-neutral-500)] font-bold uppercase">
                          Last visit
                        </p>
                        <p className="text-xs font-bold text-[var(--color-neutral-300)]">
                          {formatRelative(c.last_visit)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--color-neutral-400)] mb-3">
                      {c.phone_number && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          {c.phone_number}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--color-neutral-800)]">
                      <div>
                        <p className="text-[10px] text-[var(--color-neutral-500)] font-bold uppercase">
                          Visits
                        </p>
                        <p className="text-base font-bold text-[var(--color-neutral-100)]">
                          {c.total_visits}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--color-neutral-500)] font-bold uppercase">
                          Spent
                        </p>
                        <p className="text-base font-bold text-[var(--color-success)]">
                          ₹{c.total_spent.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--color-neutral-500)] font-bold uppercase flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" /> Joined
                        </p>
                        <p className="text-xs font-bold text-[var(--color-neutral-400)]">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CustomersDrawer;
