import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import type { DailyTrendPoint } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  thisWeek: DailyTrendPoint[];
  priorWeek: DailyTrendPoint[];
  thisCount: number;
  priorCount: number;
  delta: number;
  trend: 'up' | 'down' | undefined;
  onOpenFullAnalytics: () => void;
}

const AnalyticsWeeklyDrawer = ({
  isOpen,
  onClose,
  thisWeek,
  priorWeek,
  thisCount,
  priorCount,
  delta,
  trend,
  onOpenFullAnalytics,
}: Props) => {
  if (!isOpen) return null;

  const byDow = (rows: DailyTrendPoint[]) => {
    const m = new Map<number, number>();
    for (const r of rows) {
      const d = new Date(r.date);
      m.set(d.getDay(), (m.get(d.getDay()) || 0) + (r.appointment_count || 0));
    }
    return m;
  };
  const thisMap = byDow(thisWeek);
  const priorMap = byDow(priorWeek);
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
                <h2 className="text-2xl font-bold text-[var(--color-neutral-100)]">Weekly Analytics</h2>
                <p className="text-[var(--color-neutral-400)] text-sm mt-1">Bookings — last 7 days vs prior 7 days</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--color-surface-overlay)] transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-[var(--color-neutral-400)]" />
              </button>
            </div>

            <div className="p-6 bg-gradient-to-br from-[var(--color-success)]/15 to-transparent border-b border-[var(--color-neutral-700)]">
              <p className="text-[var(--color-neutral-400)] text-sm font-medium mb-2">Bookings this week</p>
              <div className="flex items-baseline gap-4 flex-wrap">
                <p className="text-5xl font-bold text-[var(--color-success)]">{thisCount}</p>
                {trend && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    trend === 'up'
                      ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30'
                      : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border border-[var(--color-danger)]/30'
                  }`}>
                    {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {trend === 'up' ? '+' : '-'}{Math.abs(delta)} from last week
                  </div>
                )}
              </div>
              <p className="text-xs text-[var(--color-neutral-500)] mt-2">
                Last week: <span className="font-bold text-[var(--color-neutral-300)]">{priorCount}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-400)] uppercase tracking-wide mb-4">
                Day-by-day comparison
              </h3>
              <div className="space-y-2">
                {dayLabels.map((label, dow) => {
                  const t = thisMap.get(dow) || 0;
                  const p = priorMap.get(dow) || 0;
                  const d = t - p;
                  const max = Math.max(t, p, 1);
                  return (
                    <div key={label} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)]">
                      <span className="text-sm font-bold text-[var(--color-neutral-300)]">{label}</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[var(--color-neutral-800)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-success)]" style={{ width: `${(t / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-[var(--color-success)] w-6 text-right">{t}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[var(--color-neutral-800)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-neutral-600)]" style={{ width: `${(p / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-[var(--color-neutral-500)] w-6 text-right">{p}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold tabular-nums w-10 text-right ${
                        d > 0 ? 'text-[var(--color-success)]' : d < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-neutral-600)]'
                      }`}>
                        {d > 0 ? `+${d}` : d}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-[10px] uppercase tracking-wider font-bold text-[var(--color-neutral-500)]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-success)]" /> This week</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-neutral-600)]" /> Last week</span>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-neutral-700)]">
              <button
                onClick={() => { onClose(); onOpenFullAnalytics(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] text-black font-semibold rounded-xl hover:bg-[var(--color-accent)]/90 transition-colors"
              >
                Open full analytics
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalyticsWeeklyDrawer;
