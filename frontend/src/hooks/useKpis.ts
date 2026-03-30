import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export interface KpiData {
  total_salons: number;
  total_users: number;
  todays_appointments: number;
  pending_appointments: number;
  confirmed_appointments: number;
  completed_appointments: number;
  no_shows: number;
}

export const useKpis = () => {
  return useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get<KpiData>('/api/v1/analytics/kpis');
      return data;
    },
    staleTime: 60000,
  });
};
