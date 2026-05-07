import { motion } from 'framer-motion';
import {
  TrendingUp,
  Calendar,
  Users,
  Zap,
  Plus,
  BarChart3,
  Loader2,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import KPICardView from './KPICardView';
import AppointmentRow from './AppointmentRow';
import SectionHeader from './SectionHeader';
import type { KPIData, KPICardData } from './types';
import type { DashboardAppointment } from '../../services/dashboardApi';

interface WeeklyAnalytics {
  revTrendValue: string;
  revChange: number | undefined;
  revTrend: 'up' | 'down' | undefined;
}

export interface AppointmentDrawerPayload {
  id: string;
  booking_reference: string;
  service: string;
  customer: string;
  customer_id: string | undefined;
  appointment_at: string;
  status: string;
  final_price: number | undefined;
}

interface Props {
  kpiData: KPIData | undefined;
  kpisLoading: boolean;
  kpiError: unknown;
  weeklyAnalytics: WeeklyAnalytics;
  loadingWeekly: boolean;
  todayAppointments: DashboardAppointment[] | undefined;
  appointmentsLoading: boolean;
  onShowRevenueOverview: () => void;
  onShowCustomers: () => void;
  onShowBookings: () => void;
  onJumpToAnalytics: () => void;
  onJumpToAppointments: () => void;
  onOpenAppointment: (apt: AppointmentDrawerPayload) => void;
}

const formatRevenue = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const OverviewTab = ({
  kpiData,
  kpisLoading,
  kpiError,
  weeklyAnalytics,
  loadingWeekly,
  todayAppointments,
  appointmentsLoading,
  onShowRevenueOverview,
  onShowCustomers,
  onShowBookings,
  onJumpToAnalytics,
  onJumpToAppointments,
  onOpenAppointment,
}: Props) => {
  const navigate = useNavigate();

  const kpiCards: KPICardData[] = [
    {
      label: 'Total Revenue',
      value: kpisLoading ? '...' : formatRevenue(kpiData?.total_revenue || 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'accent',
    },
    {
      label: 'Revenue Trend',
      value: loadingWeekly ? '...' : weeklyAnalytics.revTrendValue,
      icon: <TrendingUp className="w-5 h-5 text-[var(--color-success)]" />,
      color: weeklyAnalytics.revTrend === 'down' ? 'warning' : 'success',
      change: weeklyAnalytics.revChange,
      trend: weeklyAnalytics.revTrend,
      since: 'from last week',
    },
    {
      label: 'Active Customers',
      value: kpisLoading ? '...' : (kpiData?.unique_customers || 0).toString(),
      icon: <Users className="w-5 h-5" />,
      color: 'warning',
    },
    {
      label: 'Total Bookings',
      value: kpisLoading ? '...' : (kpiData?.total_appointments || 0).toString(),
      icon: <Zap className="w-5 h-5" />,
      color: 'accent',
    },
    {
      label: 'Revenue Overview',
      value: 'View Details',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'info',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-12"
    >
      <div>
        <SectionHeader title="Key Metrics" description="Real-time performance indicators" />
        {kpisLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
          </div>
        ) : kpiError ? (
          <div className="text-center py-8 text-[var(--color-neutral-400)]">
            Failed to load metrics. Please try again.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 auto-rows-fr">
            {kpiCards.map((kpi) => (
              <KPICardView
                key={kpi.label}
                data={kpi}
                onClick={
                  kpi.label === 'Revenue Overview'
                    ? onShowRevenueOverview
                    : kpi.label === 'Active Customers'
                    ? onShowCustomers
                    : kpi.label === 'Total Bookings'
                    ? onShowBookings
                    : kpi.label === 'Revenue Trend' || kpi.label.startsWith('Analytics')
                    ? onJumpToAnalytics
                    : () => console.log(`${kpi.label} clicked`)
                }
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader
          title="Today's Appointments"
          description={`${todayAppointments?.length || 0} appointments scheduled`}
          action={
            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-neutral-700)] text-[var(--color-neutral-200)] font-medium rounded-lg hover:bg-[var(--color-surface-floating)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
              aria-label="Add new appointment"
            >
              <Plus className="w-5 h-5" />
              Add Appointment
            </button>
          }
        />
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-neutral-800)] rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-5 gap-4 items-center p-4 bg-[var(--color-surface-overlay)] border-b border-[var(--color-neutral-800)] font-medium text-sm text-[var(--color-neutral-400)]">
            <div>Customer</div>
            <div>Time</div>
            <div>Staff</div>
            <div>Status</div>
            <div className="text-right">Action</div>
          </div>
          <div>
            {appointmentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
              </div>
            ) : todayAppointments && todayAppointments.length > 0 ? (
              todayAppointments.map((apt) => (
                <AppointmentRow
                  key={apt.id}
                  appointment={apt}
                  onClick={() =>
                    onOpenAppointment({
                      id: apt.id,
                      booking_reference: apt.booking_reference ?? apt.id,
                      service: apt.service_name,
                      customer: apt.customer_name,
                      customer_id: apt.customer_id ?? undefined,
                      appointment_at: apt.appointment_at,
                      status: apt.status,
                      final_price: apt.final_price ?? undefined,
                    })
                  }
                />
              ))
            ) : (
              <div className="text-center py-12 text-[var(--color-neutral-400)]">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No appointments scheduled for today</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Quick Actions" description="Common tasks" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/owner/services')}
            className="flex items-center justify-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-neutral-700)] rounded-xl hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-floating)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
            aria-label="Manage Services"
          >
            <Zap className="w-5 h-5 text-[var(--color-accent)]" />
            <span className="font-medium text-[var(--color-neutral-100)]">Manage Services</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/reports')}
            className="flex items-center justify-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-neutral-700)] rounded-xl hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-floating)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
            aria-label="View Reports"
          >
            <FileText className="w-5 h-5 text-[var(--color-accent)]" />
            <span className="font-medium text-[var(--color-neutral-100)]">View Reports</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onJumpToAppointments}
            className="flex items-center justify-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-neutral-700)] rounded-xl hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-floating)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
            aria-label="View All Appointments"
          >
            <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
            <span className="font-medium text-[var(--color-neutral-100)]">View All Appointments</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default OverviewTab;
