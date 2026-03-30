/**
 * Customer Details Hook
 *
 * React Query hooks for fetching customer data
 */

import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerAppointments } from '../services/customerApi';

// ============================================================================
// Hook: useCustomer
// ============================================================================

/**
 * Fetch customer profile by ID
 *
 * @example
 * const { data: customer, isLoading, error } = useCustomer(customerId);
 */
export const useCustomer = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customers', 'detail', customerId],
    queryFn: () => customerId ? getCustomer(customerId) : Promise.resolve(null),
    enabled: !!customerId,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

// ============================================================================
// Hook: useCustomerAppointments
// ============================================================================

/**
 * Fetch customer's appointment history
 *
 * @example
 * const { data: appointments, isLoading } = useCustomerAppointments(customerId);
 */
export const useCustomerAppointments = (
  customerId: string | undefined,
  limit: number = 50,
  offset: number = 0
) => {
  return useQuery({
    queryKey: ['customers', 'appointments', customerId, limit, offset],
    queryFn: () => customerId ? getCustomerAppointments(customerId, limit, offset) : Promise.resolve({ data: [], total: 0, page: 1, page_size: limit }),
    enabled: !!customerId,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
};
