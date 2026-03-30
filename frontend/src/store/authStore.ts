import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AuthState } from '../types';

interface AuthStore extends AuthState {
  setUser: (user: AuthUser, token: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      setUser: (user, token) =>
        set({ user, token, isAuthenticated: true, isLoading: false }),
      clearUser: () =>
        set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'auth-storage' }
  )
);
