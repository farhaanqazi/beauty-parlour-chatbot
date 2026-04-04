import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabaseClient';
import { useAuthStore } from '../store/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  timeout: 30000,
});

// Track refresh state to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use(async (config) => {
  const storedToken = useAuthStore.getState().token;

  if (!supabase) {
    // Demo mode fallback: still attach persisted token if present.
    if (storedToken) {
      config.headers.Authorization = `Bearer ${storedToken}`;
    }
    return config;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    } else if (storedToken) {
      // Fallback for startup races where session hydration lags behind persisted auth state.
      config.headers.Authorization = `Bearer ${storedToken}`;
    }
  } catch (error) {
    console.error('Failed to get session:', error);
    if (storedToken) {
      config.headers.Authorization = `Bearer ${storedToken}`;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isUnauthorized = error.response?.status === 401;

    // If error is 401 and we haven't retried yet
    if (isUnauthorized && !originalRequest._retry && supabase) {
      if (isRefreshing) {
        // Queue this request to retry after refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const { data: { session } } = await supabase.auth.refreshSession();
        
        if (session) {
          processQueue(null, session.access_token);
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        // Refresh failed - sign out and redirect to login
        await supabase.auth.signOut();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Always route unauthenticated users back to login to avoid dead-end error screens.
    if (isUnauthorized) {
      if (supabase) {
        supabase.auth.signOut();
      }
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default apiClient;
