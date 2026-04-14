/**
 * useDashboardRedirect
 * 
 * Automatically redirects users to their role-specific dashboard.
 * Follows UI/UX Pro Max Priority 9 (Navigation): Predictable routing
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

const dashboardRoutes: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  salon_owner: '/owner/dashboard',
  reception: '/reception/dashboard',
};

export const useDashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role && dashboardRoutes[user.role]) {
      // Navigate to role-specific dashboard
      // Only redirect if not already on a dashboard
      if (!window.location.pathname.includes('dashboard')) {
        navigate(dashboardRoutes[user.role], { replace: true });
      }
    }
  }, [user, navigate]);

  return dashboardRoutes[user?.role as UserRole] || '/dashboard';
};

/**
 * getRoleDashboardPath
 * Static utility to get dashboard path for a role
 */
export const getRoleDashboardPath = (role: UserRole): string => {
  return dashboardRoutes[role] || '/dashboard';
};
