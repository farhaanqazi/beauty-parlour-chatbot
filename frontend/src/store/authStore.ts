import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types';

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: AuthUser, token: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

// Compute isAuthenticated from user state instead of storing it
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      setUser: (user, token) =>
        set({ user, token, isLoading: false }),
      clearUser: () =>
        set({ user: null, token: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { 
      name: 'auth-storage',
      // Only persist user and token, not isLoading
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }),
    }
  )
);
