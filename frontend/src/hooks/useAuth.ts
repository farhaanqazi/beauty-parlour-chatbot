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

  // Initialize auth state from persisted store on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Skip auth initialization if Supabase is not configured
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Get existing session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error);
          clearUser();
          setLoading(false);
          return;
        }

        if (session) {
          // Fetch user profile
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (userError || !userData) {
            console.error('User profile not found:', userError);
            clearUser();
          } else if (userData.is_active) {
            setUser(userData as AuthUser, session.access_token);
          } else {
            console.warn('User account is inactive');
            clearUser();
          }
        } else {
          // No active session in Supabase, clear any persisted Zustand state
          clearUser();
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearUser();
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
            window.location.href = '/login';
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
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

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
      // Navigate to unified dashboard
      if (userData.role) {
        setLoading(false);
        // Small delay to ensure state propagation
        setTimeout(() => navigate('/dashboard'), 0);
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
