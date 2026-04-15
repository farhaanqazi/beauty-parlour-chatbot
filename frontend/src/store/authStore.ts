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

// Synchronously check localStorage before the store is created so we can set
// the correct initial isLoading value.  If a user is already stored, there is
// no async work to do and we should start with isLoading = false to avoid the
// ProtectedRoute redirect-to-login race condition on browser refresh.
const _hasStoredUser = (() => {
  try {
    const raw = localStorage.getItem('auth-storage');
    return !!(raw && JSON.parse(raw)?.state?.user);
  } catch {
    return false;
  }
})();

// Compute isAuthenticated from user state instead of storing it
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      // Start as false when a stored user exists — rehydration will restore the
      // user synchronously and there is no async Supabase call needed.
      isLoading: !_hasStoredUser,
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
