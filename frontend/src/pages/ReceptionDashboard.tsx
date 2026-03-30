/*
 * RECEPTION DASHBOARD
 *
 * A high-contrast, touch-friendly interface for reception staff to manage
 * the daily flow of appointments.
 *
 * UI/UX Pro Max Rules Applied:
 * - Priority 1: Accessibility (WCAG AA+, focus states, keyboard nav)
 * - Priority 4: High Contrast & Readability
 * - Priority 7: Touch-Friendliness (large targets)
 * - Priority 5: Role-Based Access
 */

import { useState } from 'react';
import { 
    Calendar, 
    Clock, 
    AlertCircle,
    ShieldCheck,
    Plus,
    UserCheck,
    CheckCircle2,
    X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTodayAppointments, useUpdateAppointmentStatus } from '../hooks/useDashboardData';
import NewAppointmentModal from '../components/dashboard/NewAppointmentModal';

// ============================================================================
// Loading & State Components (Simplified for clarity)
// ============================================================================

const AppointmentsSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-white border border-neutral-200 rounded-xl animate-pulse">
        <div className="w-12 h-12 bg-neutral-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="w-32 h-4 bg-neutral-200 rounded" />
          <div className="w-48 h-3 bg-neutral-200 rounded" />
        </div>
        <div className="w-24 h-10 bg-neutral-200 rounded-lg" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-neutral-200">
      <AlertCircle className="w-16 h-16 text-rose-500 mb-4" strokeWidth={1.5} />
      <h3 className="text-xl font-semibold text-neutral-900 mb-2">Something went wrong</h3>
      <p className="text-neutral-500 mb-6 max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
      >
        Try Again
      </button>
    </div>
);
  
const UnauthorizedAccess = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4" strokeWidth={1.5} />
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">Access Denied</h3>
        <p className="text-neutral-500 mb-4 max-w-md">This dashboard is for reception staff only.</p>
    </div>
);

const EmptyAppointments = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-neutral-200">
      <Calendar className="w-20 h-20 text-neutral-300 mb-4" strokeWidth={1.5} />
      <h3 className="text-xl font-semibold text-neutral-900 mb-2">No appointments scheduled for today</h3>
      <p className="text-neutral-500">Looks like a quiet day. Ready for walk-ins!</p>
    </div>
);

// ============================================================================
// Child Components
// ============================================================================

const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      confirmed: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2, label: 'Checked In' },
      pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock, label: 'Pending' },
      completed: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: UserCheck, label: 'Completed' },
      cancelled_by_client: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
      cancelled_by_salon: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: X, label: 'Cancelled' },
      no_show: { color: 'bg-neutral-100 text-neutral-800 border-neutral-200', icon: AlertCircle, label: 'No Show' },
    };
  
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
  
    return (
      <span 
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${config.color}`}
        role="status"
        aria-label={`Status: ${config.label}`}
      >
        <Icon className="w-4 h-4" strokeWidth={2.5} />
        {config.label}
      </span>
    );
};

const AppointmentRow = ({ appointment, onCheckIn, isUpdating }: { appointment: any, onCheckIn: () => void, isUpdating: boolean }) => {
    const time = new Date(appointment.appointment_at).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    const isCheckInDisabled = isUpdating || appointment.status === 'confirmed' || appointment.status === 'completed';
  
    return (
      <div className="flex items-center justify-between p-4 bg-white hover:bg-neutral-50 rounded-xl border border-neutral-200 shadow-sm transition-colors">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="text-xl font-bold text-blue-600 w-24 text-center" style={{fontFamily: 'Fira Code, monospace'}}>{time}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg text-neutral-900 truncate">{appointment.customer_name}</p>
            <p className="text-md text-neutral-500 truncate">{appointment.service_name}</p>
          </div>
        </div>
  
        <div className="flex items-center gap-6">
          <StatusBadge status={appointment.status} />
          <button
            onClick={onCheckIn}
            disabled={isCheckInDisabled}
            className={`px-6 py-3 text-lg font-semibold rounded-lg transition-all flex items-center gap-2
                ${isCheckInDisabled 
                    ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                }`}
            aria-label={appointment.status === 'confirmed' ? 'Already checked in' : `Check in ${appointment.customer_name}`}
          >
            <UserCheck strokeWidth={2.5} />
            Check In
          </button>
        </div>
      </div>
    );
};
  

// ============================================================================
// Main Reception Dashboard Component
// ============================================================================

const ReceptionDashboard = () => {
    const [isNewAptModalOpen, setIsNewAptModalOpen] = useState(false);
    const { user, isLoading: authLoading } = useAuth();
    const { data: appointments, isLoading: aptLoading, error: aptError, refetch: refetchApt } = useTodayAppointments();
    const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateAppointmentStatus();

    const isReception = user?.role === 'reception';
  
    if (authLoading) {
      return (
        <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
            <AppointmentsSkeleton />
        </div>
      );
    }
  
    if (!isReception) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
                <UnauthorizedAccess />
            </div>
        );
    }

    const handleCheckIn = (appointmentId: string) => {
        updateStatus({ appointmentId, status: 'confirmed' });
    };

    return (
        <div className="min-h-screen bg-neutral-100 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-neutral-900">Reception Desk</h1>
                    <p className="text-xl text-neutral-500">Today's Appointments</p>
                </div>
                <button 
                    onClick={() => setIsNewAptModalOpen(true)}
                    className="inline-flex items-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                >
                    <Plus className="w-7 h-7" strokeWidth={3} />
                    Add Walk-in
                </button>
            </div>
        </header>
  
        {/* Main Content */}
        <main className="max-w-7xl mx-auto">
            {aptLoading && <AppointmentsSkeleton />}
            {aptError && <ErrorState message="Failed to load today's appointments." onRetry={() => refetchApt()} />}
            {appointments && (
                appointments.length > 0 ? (
                    <div className="space-y-4" role="list" aria-label="Today's appointments">
                        {appointments.map((appointment) => (
                            <AppointmentRow 
                                key={appointment.id} 
                                appointment={appointment} 
                                onCheckIn={() => handleCheckIn(appointment.id)}
                                isUpdating={isUpdatingStatus}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyAppointments />
                )
            )}
        </main>

        <NewAppointmentModal 
            isOpen={isNewAptModalOpen} 
            onClose={() => setIsNewAptModalOpen(false)} 
            salonId={user?.salon_id ?? undefined} 
        />
      </div>
    );
};

export default ReceptionDashboard;
