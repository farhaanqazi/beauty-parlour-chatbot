import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types';

let authInitializationPromise: Promise<void> | null = null;
let authStateSubscriptionInitialized = false;

const initializeAuthStore = async () => {
  const { user: existingUser, setUser, clearUser, setLoading } = useAuthStore.getState();

  if (existingUser) {
    setLoading(false);
    return;
  }

  if (!supabase) {
    setLoading(false);
    return;
  }

  const timeoutId = setTimeout(() => {
    console.error('[useAuth] Auth initialization timed out after 10s');
    useAuthStore.getState().setLoading(false);
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
      return;
    }

    setUser(userData as AuthUser, session.access_token);
  } catch (error) {
    console.error('Auth initialization error:', error);
    clearUser();
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
  }
};

const ensureAuthInitialized = () => {
  if (!authInitializationPromise) {
    authInitializationPromise = initializeAuthStore().finally(() => {
      authInitializationPromise = null;
    });
  }

  return authInitializationPromise;
};

const ensureAuthStateSubscription = () => {
  const client = supabase;

  if (!client || authStateSubscriptionInitialized) {
    return;
  }

  authStateSubscriptionInitialized = true;

  client.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event);
    const currentUser = useAuthStore.getState().user;
    
    switch (event) {
      case 'SIGNED_IN':
        if (session) {
          const { data: userData } = await client
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
          useAuthStore.getState().setUser(currentUser, session.access_token);
        }
        break;

      case 'USER_UPDATED':
        if (session && currentUser) {
          const { data: userData } = await client
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
  });
};

export const useAuth = () => {
  const { user, isLoading, setUser, clearUser, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const isAuthenticated = !!user;

  useEffect(() => {
    void ensureAuthInitialized();
  }, []);

  useEffect(() => {
    ensureAuthStateSubscription();
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

      const loginPromise = supabase.auth.signInWithPassword({ email, password });
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
      const { data: userData, error: userError } = await supabase
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

      console.log('[useAuth.login] Setting user state synchronously...');
      useAuthStore.getState().setUser(userData as AuthUser, data.session.access_token);
      setUser(userData as AuthUser, data.session.access_token);

      console.log('[useAuth.login] Navigation triggered. Role:', userData.role);
      
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
    console.log('[useAuth.logout] Starting logout flow...');
    if (supabase) {
      console.log('[useAuth.logout] Calling supabase.auth.signOut()...');
      await supabase.auth.signOut();
      console.log('[useAuth.logout] Supabase signOut completed');
    }
    
    // Clear salon selection data
    localStorage.removeItem('selectedSalonId');
    localStorage.removeItem('selectedSalonName');
    
    console.log('[useAuth.logout] Clearing user state...');
    clearUser();
    console.log('[useAuth.logout] Navigating to /login...');
    navigate('/login');
  }, [clearUser, navigate]);

  return { user, isAuthenticated, isLoading, login, logout };
};
