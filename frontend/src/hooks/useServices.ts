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

export interface CreateServicePayload {
  name: string;
  code: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active?: boolean;
}

export interface UpdateServicePayload {
  name?: string;
  description?: string;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
}

export interface UseServicesState {
  services: Service[];
  loading: boolean;
  error: string | null;
}

export function useServices(salonId: string | null | undefined) {
  const [state, setState] = useState<UseServicesState>({
    services: [],
    loading: !!salonId, // only start in loading if we actually have an id
    error: null,
  });

  const fetchServices = useCallback(async () => {
    if (!salonId) {
      setState({ services: [], loading: false, error: null });
      return;
    }
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await apiClient.get(`/api/v1/salons/${salonId}`);
      setState({
        services: response.data?.services || [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState({
        services: [],
        loading: false,
        error:
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to fetch services',
      });
    }
  }, [salonId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const createService = useCallback(
    async (serviceData: CreateServicePayload): Promise<Service> => {
      if (!salonId) throw new Error('No salon selected');
      const response = await apiClient.post(
        `/api/v1/salons/${salonId}/services`,
        serviceData
      );
      await fetchServices();
      return response.data;
    },
    [salonId, fetchServices]
  );

  const updateService = useCallback(
    async (serviceId: string, updates: UpdateServicePayload): Promise<Service> => {
      if (!salonId) throw new Error('No salon selected');
      const response = await apiClient.patch(
        `/api/v1/salons/${salonId}/services/${serviceId}`,
        updates
      );
      await fetchServices();
      return response.data;
    },
    [salonId, fetchServices]
  );

  const deleteService = useCallback(
    async (serviceId: string): Promise<void> => {
      if (!salonId) throw new Error('No salon selected');
      await apiClient.delete(`/api/v1/salons/${salonId}/services/${serviceId}`);
      await fetchServices();
    },
    [salonId, fetchServices]
  );

  return {
    ...state,
    refetch: fetchServices,
    createService,
    updateService,
    deleteService,
  };
}
