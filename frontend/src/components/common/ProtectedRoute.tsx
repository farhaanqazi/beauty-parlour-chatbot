import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface Props {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Debug logging for auth state
  console.log('[ProtectedRoute] Auth state:', { isAuthenticated, user, isLoading, allowedRoles });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    console.log('[ProtectedRoute] Role not allowed, redirecting based on role:', user.role);
    // Redirect to the unified dashboard based on role
    if (user.role === 'admin') return <Navigate to="/admin/users" replace />;
    if (user.role === 'salon_owner') return <Navigate to="/owner/appointments" replace />;
    if (user.role === 'reception') return <Navigate to="/owner/appointments" replace />;
    return <Navigate to="/login" replace />;
  }

  console.log('[ProtectedRoute] Access granted, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
