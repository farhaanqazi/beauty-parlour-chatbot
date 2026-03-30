/*
 * ADMIN DASHBOARD
 *
 * System-wide overview for administrators.
 *
 * UI/UX Pro Max Rules Applied:
 * - Priority 1: Accessibility (WCAG AA+, focus states, keyboard nav)
 * - Priority 2: Data Clarity (Clear, concise information)
 * - Priority 5: Role-Based Access (Secure and appropriate views)
 */

import { 
    Building, 
    Users, 
    Calendar, 
    Clock, 
    AlertCircle,
    ShieldCheck
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminDashboardStats } from '../hooks/useDashboardData';

// ============================================================================
// Loading Skeletons
// ============================================================================

const StatCardSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-neutral-200 rounded-xl" />
    </div>
    <div className="space-y-2">
      <div className="w-24 h-8 bg-neutral-200 rounded" />
      <div className="w-32 h-4 bg-neutral-200 rounded" />
    </div>
  </div>
);

// ============================================================================
// Error & Access States
// ============================================================================

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <AlertCircle className="w-16 h-16 text-rose-500 mb-4" strokeWidth={1.5} />
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Failed to load data</h3>
    <p className="text-neutral-500 mb-4 max-w-md">{message}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
    >
      Try Again
    </button>
  </div>
);

const UnauthorizedAccess = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <ShieldCheck className="w-16 h-16 text-red-500 mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">Access Denied</h3>
      <p className="text-neutral-500 mb-4 max-w-md">You do not have the required permissions to view this page.</p>
    </div>
  );

// ============================================================================
// Child Components
// ============================================================================

const StatCard = ({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType;
}) => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
        <Icon className="w-6 h-6 text-white" strokeWidth={2} aria-hidden="true" />
      </div>
    </div>

    <div className="space-y-1">
      <p className="text-3xl font-bold text-neutral-900" style={{ fontFamily: 'Fira Code, monospace' }}>
        {value}
      </p>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  </div>
);


// ============================================================================
// Main Admin Dashboard Component
// ============================================================================

const AdminDashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useAdminDashboardStats();

  const isAdmin = user?.role === 'admin';

  if (authLoading) {
    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      );
  }

  if (!isAdmin) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
            <UnauthorizedAccess />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-pink-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
                <ShieldCheck className="w-6 h-6 text-white" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-neutral-900">Admin Dashboard</h1>
                <p className="text-xs text-neutral-500">System-Wide Overview</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {statsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
            </div>
        )}
        {statsError && (
            <ErrorState 
                message="Failed to load system analytics. Please check the API connection." 
                onRetry={() => refetchStats()} 
            />
        )}
        {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
                label="Total Salons" 
                value={stats.total_salons} 
                icon={Building} 
            />
            <StatCard 
                label="Total Users" 
                value={stats.total_users} 
                icon={Users} 
            />
            <StatCard 
                label="Today's Appointments" 
                value={stats.todays_appointments} 
                icon={Calendar} 
            />
            <StatCard 
                label="Pending Appointments" 
                value={stats.pending_appointments} 
                icon={Clock} 
            />
            </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
