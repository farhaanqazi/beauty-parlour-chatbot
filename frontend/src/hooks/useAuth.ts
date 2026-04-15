import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types';

export const useAuth = () => {
  const { user, isLoading, setUser, clearUser, setLoading } = useAuthStore();
  const navigate = useNavigate();
  
  // Compute isAuthenticated from user state
  const isAuthenticated = !!user;

  // Initialize auth state on mount.
  // The Zustand persist store sets isLoading=false once localStorage is read,
  // so this effect only needs to handle the truly-fresh (no persisted user) case.
  useEffect(() => {
    const initializeAuth = async () => {
      // If there's already a persisted user the store is ready — nothing to do.
      // isLoading was already set to false by onRehydrateStorage.
      const existingUser = useAuthStore.getState().user;
      if (existingUser) return;

      // No persisted user — check Supabase for an active session.
      if (!supabase) {
        setLoading(false);
        return;
      }

      const timeoutId = setTimeout(() => {
        console.error('[useAuth] Auth initialization timed out after 10s');
        setLoading(false);
      }, 10_000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          clearTimeout(timeoutId);
          clearUser();
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData || !userData.is_active) {
          clearUser();
        } else {
          setUser(userData as AuthUser, session.access_token);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearUser();
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    initializeAuth();
  }, [setLoading, setUser, clearUser]);

  // Listen for auth state changes
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        const currentUser = useAuthStore.getState().user;
        
        switch (event) {
          case 'SIGNED_IN':
            if (session) {
              // Fetch user profile on sign in
              const { data: userData } = await supabase!
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (userData && userData.is_active) {
                useAuthStore.getState().setUser(userData as AuthUser, session.access_token);
              }
            }
            break;

          case 'SIGNED_OUT':
            useAuthStore.getState().clearUser();
            break;

          case 'TOKEN_REFRESHED':
            if (session && currentUser) {
              // Update token in store (user object stays the same)
              useAuthStore.getState().setUser(currentUser, session.access_token);
            }
            break;

          case 'USER_UPDATED':
            if (session && currentUser) {
              // Refresh user data
              const { data: userData } = await supabase!
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (userData) {
                useAuthStore.getState().setUser(userData as AuthUser, session.access_token);
              }
            }
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      console.error('[useAuth.login] Supabase client is not configured');
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }

    setLoading(true);
    console.log('[useAuth.login] Starting login flow for:', email);

    try {
      console.log('[useAuth.login] Calling supabase.auth.signInWithPassword...');

      // Add timeout to prevent infinite hang if Supabase is unreachable
      const loginPromise = supabase!.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Login request timed out after 10s. Please check your connection and try again.')), 10_000)
      );

      const { data, error } = await Promise.race([
        loginPromise,
        timeoutPromise,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      console.log('[useAuth.login] signInWithPassword completed. Error:', error?.message);

      if (error || !data.session) {
        setLoading(false);
        throw new Error(error?.message || 'Login failed');
      }

      console.log('[useAuth.login] Fetching user profile from Supabase...');
      // Fetch user profile
      const { data: userData, error: userError } = await supabase!
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();
      
      console.log('[useAuth.login] User profile fetched. Error:', userError?.message);

      if (userError || !userData) {
        setLoading(false);
        throw new Error('User profile not found. Contact your administrator.');
      }

      if (!userData.is_active) {
        setLoading(false);
        throw new Error('Your account is inactive. Contact your administrator.');
      }

      // Explicitly set the user to state BEFORE navigating to avoid ProtectedRoute bouncing back
      console.log('[useAuth.login] Setting user state synchronously...');

      // Set both Zustand store AND local state to ensure consistency
      useAuthStore.getState().setUser(userData as AuthUser, data.session.access_token);

      // Also update local state via setUser to ensure isAuthenticated is true immediately
      setUser(userData as AuthUser, data.session.access_token);

      console.log('[useAuth.login] Navigation triggered. Role:', userData.role);
      
      // Navigate based on role: admins go to salon selection, others go direct to role-specific dashboard
      if (userData.role === 'admin') {
        setLoading(false);
        setTimeout(() => navigate('/salon-select'), 0);
      } else if (userData.role === 'salon_owner') {
        setLoading(false);
        setTimeout(() => navigate('/owner/dashboard'), 0);
      } else if (userData.role === 'reception') {
        setLoading(false);
        setTimeout(() => navigate('/reception/dashboard'), 0);
      } else {
        setLoading(false);
        navigate('/login');
      }

    } catch (error) {
      console.error('[useAuth.login] Exception caught:', error);
      setLoading(false);
      throw error;
    }
  }, [navigate, setLoading, setUser]);

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearUser();
    navigate('/login');
  }, [clearUser, navigate]);

  return { user, isAuthenticated, isLoading, login, logout };
};
