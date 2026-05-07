import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardKeys, fetchTrend } from '../api';

interface SelectedWeekDelta {
  priorRev: number;
  delta: number;
  pct: number | undefined;
  trend: 'up' | 'down' | undefined;
}

/**
 * Owns the Analytics-tab week navigator: selected week + its prior week, plus
 * the trend pill comparison shown beneath gross weekly revenue.
 *
 * `enabled` gates the network fetch — pass `selectedTab === 'analytics'` so the
 * queries only fire on that tab.
 */
export const useSelectedWeek = ({
  enabled,
  salonId,
}: {
  enabled: boolean;
  salonId?: string;
}) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekRange = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    return {
      start: monday.toISOString(),
      end: sunday.toISOString(),
      mondayDate: monday,
      label: `${fmt(monday)} – ${fmt(sunday)}`,
    };
  }, [weekOffset]);

  const priorRange = useMemo(() => {
    const monday = new Date(weekRange.mondayDate);
    const priorMonday = new Date(monday);
    priorMonday.setDate(priorMonday.getDate() - 7);
    return {
      start: priorMonday.toISOString(),
      end: monday.toISOString(),
    };
  }, [weekRange]);

  const { data: selectedWeekTrend, isLoading: loadingSelectedWeek } = useQuery({
    queryKey: dashboardKeys.analyticsWeek(weekOffset, salonId),
    queryFn: () => fetchTrend(weekRange.start, weekRange.end),
    enabled,
    staleTime: 60_000,
  });
  const { data: priorOfSelectedTrend } = useQuery({
    queryKey: dashboardKeys.analyticsWeekPrior(weekOffset, salonId),
    queryFn: () => fetchTrend(priorRange.start, priorRange.end),
    enabled,
    staleTime: 60_000,
  });

  const delta = useMemo<SelectedWeekDelta>(() => {
    const sum = (rows?: { revenue: number }[]) =>
      (rows ?? []).reduce((s, r) => s + (r.revenue || 0), 0);
    const thisRev = sum(selectedWeekTrend?.data);
    const priorRev = sum(priorOfSelectedTrend?.data);
    if (priorRev === 0) {
      return {
        priorRev,
        delta: thisRev,
        pct: thisRev > 0 ? 100 : undefined,
        trend: thisRev > 0 ? 'up' : undefined,
      };
    }
    const d = thisRev - priorRev;
    const pct = Math.round((d / priorRev) * 100);
    return {
      priorRev,
      delta: d,
      pct,
      trend: d === 0 ? undefined : d > 0 ? 'up' : 'down',
    };
  }, [selectedWeekTrend, priorOfSelectedTrend]);

  return {
    weekOffset,
    setWeekOffset,
    weekRange,
    selectedWeekTrend,
    loadingSelectedWeek,
    delta,
  };
};
