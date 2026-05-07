import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { RevenueByService } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  revenueByService: RevenueByService[];
  totalRevenue: number;
}

const RevenueOverviewModal = ({
  isOpen,
  onClose,
  revenueByService,
  totalRevenue,
}: Props) => {
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
                  Revenue Overview
                </h2>
                <p className="text-[var(--color-neutral-400)] text-sm mt-1">
                  Revenue breakdown by service (all bookings)
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

            <div className="p-6 bg-gradient-to-br from-[var(--color-accent)]/20 to-transparent border-b border-[var(--color-neutral-700)]">
              <p className="text-[var(--color-neutral-400)] text-sm font-medium mb-2">
                Total Revenue (All Bookings)
              </p>
              <p className="text-4xl font-bold text-[var(--color-accent)]">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-400)] uppercase tracking-wide px-6 pt-6 pb-4">
                All Services by Revenue
              </h3>
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 min-h-0">
                {revenueByService.filter((item) => item.revenue > 0).length === 0 ? (
                  <p className="text-[var(--color-neutral-500)] text-center py-8">
                    No revenue data available yet.
                  </p>
                ) : (
                  revenueByService
                    .filter((item) => item.revenue > 0)
                    .map((item, index) => {
                      const percentage =
                        totalRevenue > 0
                          ? ((item.revenue / totalRevenue) * 100).toFixed(1)
                          : '0';
                      return (
                        <motion.div
                          key={item.service}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-700)] hover:border-[var(--color-accent)]/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-[var(--color-neutral-100)] font-semibold">
                                {item.service}
                              </p>
                              <p className="text-[var(--color-neutral-500)] text-sm">
                                {item.count} booking{item.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[var(--color-neutral-100)] font-bold">
                              ₹{item.revenue.toLocaleString('en-IN')}
                            </p>
                            <p className="text-[var(--color-success)] text-sm">{percentage}%</p>
                          </div>
                        </motion.div>
                      );
                    })
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RevenueOverviewModal;
