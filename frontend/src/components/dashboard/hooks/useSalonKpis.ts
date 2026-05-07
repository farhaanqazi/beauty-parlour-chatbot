import { useQuery } from '@tanstack/react-query';
import { dashboardKeys, fetchKPIs } from '../api';

export const useSalonKpis = () =>
  useQuery({
    queryKey: dashboardKeys.kpis,
    queryFn: fetchKPIs,
    refetchInterval: 60000,
  });
