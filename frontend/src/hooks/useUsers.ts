import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'salon_owner' | 'staff' | 'reception';
  salon_id: string | null;
  salon_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UseUsersState {
  users: User[];
  loading: boolean;
  error: string | null;
}

export function useUsers(salonId?: string) {
  const [state, setState] = useState<UseUsersState>({
    users: [],
    loading: true,
    error: null,
  });

  const fetchUsers = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const params = new URLSearchParams();
      if (salonId) params.append('salon_id', salonId);
      
      const response = await apiClient.get(`/users?${params.toString()}`);
      setState({
        users: response.data || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch users',
      }));
    }
  }, [salonId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(
    async (userData: {
      email: string;
      full_name: string;
      role: string;
      salon_id?: string;
    }) => {
      try {
        const params = new URLSearchParams();
        params.append('email', userData.email);
        params.append('full_name', userData.full_name);
        params.append('role', userData.role);
        if (userData.salon_id) params.append('salon_id', userData.salon_id);

        const response = await apiClient.post(`/users?${params.toString()}`, {});
        await fetchUsers(); // Refresh list
        return response;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to create user');
      }
    },
    [fetchUsers]
  );

  const updateUser = useCallback(
    async (
      userId: string,
      updates: {
        full_name?: string;
        is_active?: boolean;
      }
    ) => {
      try {
        const params = new URLSearchParams();
        if (updates.full_name) params.append('full_name', updates.full_name);
        if (updates.is_active !== undefined) params.append('is_active', String(updates.is_active));

        const response = await apiClient.patch(
          `/users/${userId}?${params.toString()}`,
          {}
        );
        await fetchUsers(); // Refresh list
        return response;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to update user');
      }
    },
    [fetchUsers]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      try {
        await apiClient.delete(`/users/${userId}`);
        await fetchUsers(); // Refresh list
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to delete user');
      }
    },
    [fetchUsers]
  );

  return {
    ...state,
    refetch: fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
}
