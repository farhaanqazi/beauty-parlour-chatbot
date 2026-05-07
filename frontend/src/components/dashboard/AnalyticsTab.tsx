import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { RevenueTrendResponse } from './types';

interface SelectedWeekDelta {
  priorRev: number;
  delta: number;
  pct: number | undefined;
  trend: 'up' | 'down' | undefined;
}

interface Props {
  weekOffset: number;
  setWeekOffset: Dispatch<SetStateAction<number>>;
  weekRange: { start: string; end: string; mondayDate: Date; label: string };
  selectedWeekTrend: RevenueTrendResponse | undefined;
  loadingSelectedWeek: boolean;
  selectedWeekDelta: SelectedWeekDelta;
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const AnalyticsTab = ({
  weekOffset,
  setWeekOffset,
  weekRange,
  selectedWeekTrend,
  loadingSelectedWeek,
  selectedWeekDelta,
}: Props) => {
  const grossRevenue = (selectedWeekTrend?.data || []).reduce(
    (acc, r) => acc + (r.revenue || 0),
    0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex flex-col h-full overflow-hidden bg-[var(--color-surface-overlay)] rounded-[2.5rem] border border-[var(--color-neutral-800)] shadow-2xl">
        <div className="px-8 pt-10 pb-12 bg-gradient-to-b from-[var(--color-success)]/10 to-transparent border-b border-[var(--color-neutral-800)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-black text-white mb-2">Revenue Analytics</h2>
              <p className="text-[var(--color-neutral-400)] font-medium">
                Real-time performance tracking and growth insights
              </p>
            </div>
            <div className="flex items-center gap-4 bg-[var(--color-surface-base)] p-2 rounded-2xl border border-[var(--color-neutral-800)] shadow-lg">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="p-2.5 hover:bg-[var(--color-surface-overlay)] rounded-xl transition-all text-[var(--color-neutral-400)] hover:text-white"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center px-6">
                <p className="text-[10px] text-[var(--color-neutral-500)] font-black uppercase tracking-widest mb-1">
                  {weekOffset === 0
                    ? 'Current Week'
                    : weekOffset === -1
                    ? 'Last Week'
                    : `${Math.abs(weekOffset)} Weeks Ago`}
                </p>
                <p className="text-sm font-bold text-white whitespace-nowrap">{weekRange.label}</p>
              </div>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                disabled={weekOffset >= 0}
                className="p-2.5 hover:bg-[var(--color-surface-overlay)] rounded-xl transition-all text-[var(--color-neutral-400)] hover:text-white disabled:opacity-0"
                aria-label="Next week"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-end justify-between gap-12">
            <div>
              <p className="text-[var(--color-neutral-500)] text-xs font-black uppercase tracking-[0.2em] mb-4">
                Gross Weekly Revenue
              </p>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-black text-[var(--color-success)]">₹</span>
                <h3 className="text-7xl font-black text-white tracking-tighter">
                  {grossRevenue.toLocaleString('en-IN')}
                </h3>
              </div>
              <div className="mt-5 flex items-center gap-4 flex-wrap">
                {selectedWeekDelta.trend ? (
                  <>
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-base font-black uppercase tracking-wide border-2 ${
                        selectedWeekDelta.trend === 'up'
                          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/40 shadow-[0_0_24px_rgba(34,197,94,0.15)]'
                          : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/40 shadow-[0_0_24px_rgba(239,68,68,0.15)]'
                      }`}
                    >
                      {selectedWeekDelta.trend === 'up' ? (
                        <ArrowUpRight className="w-5 h-5" strokeWidth={2.5} />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" strokeWidth={2.5} />
                      )}
                      <span>
                        {selectedWeekDelta.pct !== undefined
                          ? `${selectedWeekDelta.trend === 'up' ? 'Up' : 'Down'} ${Math.abs(
                              selectedWeekDelta.pct,
                            )}%`
                          : `Up ₹${Math.abs(selectedWeekDelta.delta).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-neutral-500)]">
                      {selectedWeekDelta.priorRev === 0
                        ? `+₹${Math.abs(selectedWeekDelta.delta).toLocaleString('en-IN')} vs ₹0 last week (no baseline)`
                        : `${selectedWeekDelta.trend === 'up' ? '+' : '-'}₹${Math.abs(
                            selectedWeekDelta.delta,
                          ).toLocaleString('en-IN')} vs ₹${selectedWeekDelta.priorRev.toLocaleString(
                            'en-IN',
                          )} last week`}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-end gap-3 h-40 w-full lg:w-96">
              {loadingSelectedWeek ? (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-neutral-800)]/20 rounded-xl border border-dashed border-[var(--color-neutral-800)]">
                  <Loader2 className="w-6 h-6 text-[var(--color-success)] animate-spin" />
                </div>
              ) : (
                (() => {
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  const weeklyValues = days.map((_, idx) => {
                    const dayDate = new Date(weekRange.mondayDate);
                    dayDate.setDate(dayDate.getDate() + idx);
                    const match = (selectedWeekTrend?.data || []).find(
                      (d) => d.date && d.date.split('T')[0] === dateKey(dayDate),
                    );
                    return match?.revenue || 0;
                  });
                  const max = Math.max(...weeklyValues, 1000);
                  return weeklyValues.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end h-full">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max((val / max) * 100, 8)}%` }}
                        className={`w-full rounded-t-md transition-all duration-700 ${
                          val > 0
                            ? 'bg-[var(--color-success)] shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                            : 'bg-[var(--color-neutral-800)]'
                        }`}
                      />
                      <div className="mt-4 text-center">
                        <span className="text-[10px] font-black text-[var(--color-neutral-500)] uppercase">
                          {days[i].charAt(0)}
                        </span>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex items-center justify-between border-b border-[var(--color-neutral-800)] pb-6">
            <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="p-2 bg-[var(--color-success)]/10 rounded-lg">
                <BarChart3 className="w-4 h-4 text-[var(--color-success)]" />
              </div>
              Detailed Daily Ledger
            </h4>
            <div className="text-xs text-[var(--color-neutral-500)] font-bold">
              Values based on confirmed &amp; completed bookings
            </div>
          </div>

          {loadingSelectedWeek ? (
            <div className="py-24 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-[var(--color-success)] animate-spin mb-4" />
              <p className="text-[var(--color-neutral-500)] font-bold tracking-widest uppercase text-xs">
                Synchronizing data...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                (dayName, i) => {
                  const dayDate = new Date(weekRange.mondayDate);
                  dayDate.setDate(dayDate.getDate() + i);
                  const match = (selectedWeekTrend?.data || []).find(
                    (d) => d.date && d.date.split('T')[0] === dateKey(dayDate),
                  );
                  const val = match?.revenue || 0;
                  const apts = match?.appointment_count || 0;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={`group p-6 rounded-3xl border transition-all duration-300 ${
                        val > 0
                          ? 'bg-[var(--color-surface-base)] border-[var(--color-neutral-800)] hover:border-[var(--color-success)]/40 hover:shadow-2xl'
                          : 'bg-transparent border-[var(--color-neutral-800)]/30 opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            val > 0
                              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                              : 'bg-[var(--color-neutral-800)] text-[var(--color-neutral-500)]'
                          }`}
                        >
                          {dayName}
                        </div>
                        <span className="text-[10px] text-[var(--color-neutral-500)] font-bold">
                          {dayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] text-[var(--color-neutral-500)] font-black uppercase tracking-widest mb-1">
                            Earned
                          </p>
                          <p
                            className={`text-2xl font-black ${
                              val > 0 ? 'text-white' : 'text-[var(--color-neutral-700)]'
                            }`}
                          >
                            ₹{val.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--color-neutral-500)] font-black uppercase tracking-widest mb-1">
                            Bookings
                          </p>
                          <p
                            className={`font-black ${
                              val > 0 ? 'text-white' : 'text-[var(--color-neutral-700)]'
                            }`}
                          >
                            {apts}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AnalyticsTab;
