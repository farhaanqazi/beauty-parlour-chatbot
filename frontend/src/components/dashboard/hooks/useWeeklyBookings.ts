import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardKeys, fetchTrend } from '../api';

interface WeeklyAnalytics {
  thisCount: number;
  priorCount: number;
  delta: number;
  trend: 'up' | 'down' | undefined;
  revTrendValue: string;
  revChange: number | undefined;
  revTrend: 'up' | 'down' | undefined;
}

const sumCount = (rows?: { appointment_count: number }[]) =>
  (rows ?? []).reduce((s, r) => s + (r.appointment_count || 0), 0);
const sumRev = (rows?: { revenue: number }[]) =>
  (rows ?? []).reduce((s, r) => s + (r.revenue || 0), 0);

/**
 * This 7-day window vs prior 7-day window — drives the Revenue Trend KPI card
 * and the weekly bookings drawer on the Overview tab.
 */
export const useWeeklyBookings = (salonId?: string) => {
  const ranges = useMemo(() => {
    const now = new Date();
    const thisStart = new Date(now);
    thisStart.setDate(thisStart.getDate() - 7);
    const priorStart = new Date(now);
    priorStart.setDate(priorStart.getDate() - 14);
    return {
      thisStart: thisStart.toISOString(),
      thisEnd: now.toISOString(),
      priorStart: priorStart.toISOString(),
      priorEnd: thisStart.toISOString(),
    };
  }, []);

  const { data: thisWeekTrend, isLoading: loadingThisWeek } = useQuery({
    queryKey: dashboardKeys.weeklyBookings('this', salonId),
    queryFn: () => fetchTrend(ranges.thisStart, ranges.thisEnd),
    staleTime: 5 * 60 * 1000,
  });
  const { data: priorWeekTrend, isLoading: loadingPriorWeek } = useQuery({
    queryKey: dashboardKeys.weeklyBookings('prior', salonId),
    queryFn: () => fetchTrend(ranges.priorStart, ranges.priorEnd),
    staleTime: 5 * 60 * 1000,
  });

  const analytics = useMemo<WeeklyAnalytics>(() => {
    const thisCount = sumCount(thisWeekTrend?.data);
    const priorCount = sumCount(priorWeekTrend?.data);
    const delta = thisCount - priorCount;
    const thisRev = sumRev(thisWeekTrend?.data);
    const priorRev = sumRev(priorWeekTrend?.data);

    let revTrendValue: string;
    let revChange: number | undefined;
    let revTrend: 'up' | 'down' | undefined;
    if (priorRev === 0) {
      revTrendValue = thisRev > 0 ? 'New' : 'No data';
      revChange = undefined;
      revTrend = undefined;
    } else {
      const pct = Math.round(((thisRev - priorRev) / priorRev) * 100);
      revTrendValue = pct >= 0 ? `Up ${pct}%` : `Down ${Math.abs(pct)}%`;
      revChange = Math.abs(pct);
      revTrend = pct >= 0 ? 'up' : 'down';
    }

    return {
      thisCount,
      priorCount,
      delta,
      trend: (delta === 0 ? undefined : delta > 0 ? 'up' : 'down') as WeeklyAnalytics['trend'],
      revTrendValue,
      revChange,
      revTrend,
    };
  }, [thisWeekTrend, priorWeekTrend]);

  return {
    thisWeekTrend,
    priorWeekTrend,
    analytics,
    loading: loadingThisWeek || loadingPriorWeek,
  };
};
