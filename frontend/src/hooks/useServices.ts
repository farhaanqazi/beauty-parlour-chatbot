import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

export interface Service {
  id: string;
  code: string;
  name: string;
  description: string;
  duration_minutes: number;
  price?: number;
  is_active: boolean;
  sample_image_urls?: string[];
}

export interface UseServicesState {
  services: Service[];
  loading: boolean;
  error: string | null;
}

export function useServices(salonId: string) {
  const [state, setState] = useState<UseServicesState>({
    services: [],
    loading: true,
    error: null,
  });

  const fetchServices = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Get salon details which includes services
      const response = await apiClient.get(`/salons/${salonId}`);
      setState({
        services: response.data?.services || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch services',
      }));
    }
  }, [salonId]);

  useEffect(() => {
    if (salonId) {
      fetchServices();
    }
  }, [salonId, fetchServices]);

  // Note: These would require backend endpoints to be implemented
  const updateService = useCallback(
    async (_serviceId: string, _updates: Partial<Service>) => {
      try {
        // TODO: Implement in backend - PATCH /services/{serviceId}
        console.warn('updateService requires backend implementation');
        await fetchServices();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to update service');
      }
    },
    [fetchServices]
  );

  const createService = useCallback(
    async (_serviceData: Omit<Service, 'id'>) => {
      try {
        // TODO: Implement in backend - POST /services
        console.warn('createService requires backend implementation');
        await fetchServices();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to create service');
      }
    },
    [fetchServices]
  );

  return {
    ...state,
    refetch: fetchServices,
    updateService,
    createService,
  };
}
