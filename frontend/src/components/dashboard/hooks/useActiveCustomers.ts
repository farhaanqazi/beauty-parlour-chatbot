import { useQuery } from '@tanstack/react-query';
import { dashboardKeys, fetchActiveCustomers } from '../api';

/**
 * Active customers (those with at least one appointment) for the salon.
 * `enabled` should gate to when the drawer is open, so we don't pre-fetch.
 */
export const useActiveCustomers = ({
  enabled,
  salonId,
}: {
  enabled: boolean;
  salonId?: string;
}) =>
  useQuery({
    queryKey: dashboardKeys.activeCustomers(salonId),
    queryFn: () => fetchActiveCustomers(salonId),
    enabled,
    staleTime: 60_000,
  });
