/**
 * SALON OWNER DASHBOARD
 *
 * UI/UX Pro Max Rules Applied:
 * - Priority 1 (Accessibility): WCAG 4.5:1 contrast, keyboard nav, ARIA labels
 * - Priority 2 (Touch): 48px button targets, 8px+ spacing
 * - Priority 5 (Layout): Mobile-first responsive grid, breakpoint system
 * - Priority 6 (Typography): 16px base, semantic color tokens
 * - Priority 7 (Animation): 150-300ms Framer Motion transitions
 * - Priority 8 (Forms): Error placement, loading feedback
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  Users,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Plus,
  Settings,
  BarChart3,
  X,
  ChevronRight,
  Loader2,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

// ============================================================
// TYPES
// ============================================================

interface KPICard {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
  color: 'accent' | 'success' | 'info' | 'warning';
  action?: React.ReactNode; // For buttons next to KPI
}

interface Appointment {
  id: string;
  customer_name: string;
  service_name: string;
  appointment_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  staff_name: string;
}

interface RevenueByService {
  service: string;
  count: number;
  revenue: number;
}

interface KPIData {
  total_revenue: number;
  total_appointments: number;
  todays_appointments: number;
  unique_customers: number;
  revenue_by_service: RevenueByService[];
}

// ============================================================
// API FETCH FUNCTIONS
// ============================================================

const fetchKPIs = async (): Promise<KPIData> => {
  const { data } = await apiClient.get('/api/v1/analytics/kpis');
  return data;
};

// ============================================================
// REVENUE OVERVIEW MODAL
// ============================================================

const RevenueOverviewModal = ({
  isOpen,
  onClose,
  revenueByService,
  totalRevenue,
}: {
  isOpen: boolean;
  onClose: () => void;
  revenueByService: RevenueByService[];
  totalRevenue: number;
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--color-surface-raised)] border border-[var(--color-neutral-700)] rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-neutral-700)]">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-neutral-100)]">
                  Revenue Overview
                </h2>
                <p className="text-[var(--color-neutral-400)] text-sm mt-1">
                  Revenue breakdown by service (all bookings)
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[var(--color-surface-overlay)] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-[var(--color-neutral-400)]" />
              </button>
            </div>

            {/* Total Revenue Card */}
            <div className="p-6 bg-gradient-to-br from-[var(--color-accent)]/20 to-transparent border-b border-[var(--color-neutral-700)]">
              <p className="text-[var(--color-neutral-400)] text-sm font-medium mb-2">
                Total Revenue (All Bookings)
              </p>
              <p className="text-4xl font-bold text-[var(--color-accent)]">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Revenue by Service List - All Services */}
            <div className="p-6 flex flex-col max-h-[60vh]">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-400)] uppercase tracking-wide mb-4">
                All Services by Revenue
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {/* Filter out zero-revenue services, but show ALL that have revenue */}
                {revenueByService
                  .filter(item => item.revenue > 0)
                  .length === 0 ? (
                  <p className="text-[var(--color-neutral-500)] text-center py-8">
                    No revenue data available yet.
                  </p>
                ) : (
                  revenueByService
                    .filter(item => item.revenue > 0) // Show ALL, not just top 5
                    .map((item, index) => {
                      const percentage = totalRevenue > 0
                        ? ((item.revenue / totalRevenue) * 100).toFixed(1)
                        : '0';
                      return (
                        <motion.div
                          key={item.service}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-700)] hover:border-[var(--color-accent)]/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-[var(--color-neutral-100)] font-semibold">
                                {item.service}
                              </p>
                              <p className="text-[var(--color-neutral-500)] text-sm">
                                {item.count} booking{item.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[var(--color-neutral-100)] font-bold">
                              ₹{item.revenue.toLocaleString('en-IN')}
                            </p>
                            <p className="text-[var(--color-success)] text-sm">
                              {percentage}%
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================
// MOCK DATA (Temporary for appointments table)
// ============================================================

const mockAppointments: Appointment[] = [
  {
    id: '1',
    customer_name: 'Priya Sharma',
    service_name: 'Bridal Makeup',
    appointment_at: '2026-04-11T10:00:00Z',
    status: 'confirmed',
    staff_name: 'Anjali',
  },
  {
    id: '2',
    customer_name: 'Neha Patel',
    service_name: 'Hair Styling',
    appointment_at: '2026-04-11T11:30:00Z',
    status: 'pending',
    staff_name: 'Priya',
  },
  {
    id: '3',
    customer_name: 'Kavya Singh',
    service_name: 'Facial Treatment',
    appointment_at: '2026-04-11T14:00:00Z',
    status: 'confirmed',
    staff_name: 'Anjali',
  },
];

// ============================================================
// COMPONENTS
// ============================================================

/**
 * KPI CARD
 * UI/UX Pro Max - Priority 2 (Touch): Tap targets 48px + 8px gaps
 * Priority 6 (Typography): Semantic color tokens
 */
const KPICard = ({ data, onClick }: { data: KPICard; onClick?: () => void }) => {
  const colorMap = {
    accent: 'from-[var(--color-accent)]/20 to-transparent border-[var(--color-accent)]/30 text-[var(--color-accent)]',
    success: 'from-[var(--color-success)]/20 to-transparent border-[var(--color-success)]/30 text-[var(--color-success)]',
    info: 'from-[var(--color-info)]/20 to-transparent border-[var(--color-info)]/30 text-[var(--color-info)]',
    warning: 'from-[var(--color-warning)]/20 to-transparent border-[var(--color-warning)]/30 text-[var(--color-warning)]',
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative w-full h-full flex flex-col justify-between bg-gradient-to-br ${colorMap[data.color]} border rounded-2xl p-6 backdrop-blur-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 cursor-pointer overflow-visible`}
    >
      {/* Header: Icon + Label */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[var(--color-surface-overlay)]">
            {data.icon}
          </div>
        </div>
        <button
          className="p-2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-200)] hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors duration-150"
          aria-label="More options"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[var(--color-neutral-300)] text-base font-semibold mb-1">
        {data.label}
      </p>

      {/* Value */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-2xl font-bold text-[var(--color-neutral-100)]">
          {data.value}
        </h3>
      </div>

      {/* Trend Indicator (optional) */}
      {data.trend !== undefined && data.change !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          {data.trend === 'up' ? (
            <>
              <ArrowUpRight className="w-4 h-4 text-[var(--color-success)]" />
              <span className="text-[var(--color-success)]">+{data.change}%</span>
            </>
          ) : (
            <>
              <ArrowDownRight className="w-4 h-4 text-[var(--color-danger)]" />
              <span className="text-[var(--color-danger)]">-{Math.abs(data.change)}%</span>
            </>
          )}
          <span className="text-[var(--color-neutral-500)]">from last month</span>
        </div>
      )}
    </motion.button>
  );
};

/**
 * APPOINTMENT ROW
 * UI/UX Pro Max - Priority 2: Min 44px height for touch
 */
const AppointmentRow = ({ appointment }: { appointment: Appointment }) => {
  const statusColorMap = {
    pending: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border-[var(--color-warning)]/20',
    confirmed: 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/20',
    completed: 'bg-[var(--color-info)]/20 text-[var(--color-info)] border-[var(--color-info)]/20',
    cancelled: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)] border-[var(--color-danger)]/20',
  };

  const appointmentDate = new Date(appointment.appointment_at).toLocaleDateString(
    'en-IN',
    { year: 'numeric', month: 'short', day: '2-digit' }
  );

  const appointmentTime = new Date(appointment.appointment_at).toLocaleTimeString(
    'en-IN',
    { hour: '2-digit', minute: '2-digit' }
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-4 border-b border-[var(--color-neutral-800)] hover:bg-[var(--color-surface-overlay)]/50 transition-colors duration-150 last:border-0"
    >
      {/* Customer Name */}
      <div>
        <p className="font-medium text-[var(--color-neutral-100)]">
          {appointment.customer_name}
        </p>
        <p className="text-xs text-[var(--color-neutral-500)]">{appointment.service_name}</p>
      </div>

      {/* Date & Time */}
      <div className="text-sm text-[var(--color-neutral-300)]">
        <div className="font-medium">{appointmentDate}</div>
        <div className="text-xs text-[var(--color-neutral-500)]">{appointmentTime}</div>
      </div>

      {/* Staff */}
      <div className="text-sm text-[var(--color-neutral-300)]">
        {appointment.staff_name}
      </div>

      {/* Status Badge */}
      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border w-fit ${statusColorMap[appointment.status]}`}>
        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <button
          className="px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
          aria-label={`View details for ${appointment.customer_name}`}
        >
          View
        </button>
      </div>
    </motion.div>
  );
};

/**
 * SECTION HEADER
 * UI/UX Pro Max - Priority 6: Semantic typography hierarchy
 */
const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-neutral-100)] mb-1">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-[var(--color-neutral-400)]">{description}</p>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SalonOwnerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'appointments' | 'analytics'>(
    'overview'
  );
  const [showRevenueOverview, setShowRevenueOverview] = useState(false);

  // Fetch real KPI data from backend
  const { data: kpiData, isLoading: kpisLoading, error: kpiError } = useQuery({
    queryKey: ['kpis'],
    queryFn: fetchKPIs,
    refetchInterval: 60000, // Refetch every minute
  });

  if (user?.role !== 'salon_owner') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-surface-base)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--color-neutral-100)] mb-2">
            Access Denied
          </h1>
          <p className="text-[var(--color-neutral-400)]">
            This dashboard is only available for salon owners.
          </p>
        </div>
      </div>
    );
  }

  // Format revenue as Indian Rupees
  const formatRevenue = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  // Build KPI cards with real data
  const kpiCards: KPICard[] = [
    {
      label: 'Total Revenue',
      value: kpisLoading ? '...' : formatRevenue(kpiData?.total_revenue || 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'accent',
    },
    {
      label: 'Revenue Overview',
      value: 'View Details',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'info',
    },
    {
      label: 'Appointments Today',
      value: kpisLoading ? '...' : (kpiData?.todays_appointments || 0).toString(),
      icon: <Calendar className="w-5 h-5" />,
      color: 'success',
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
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)] text-[var(--color-neutral-100)]">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-[var(--color-surface-raised)]/80 backdrop-blur-sm border-b border-[var(--color-neutral-800)] px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Salon Owner Dashboard</h1>
            <p className="text-[var(--color-neutral-400)] mt-1">
              Welcome back, {user?.full_name}
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-accent)] text-[var(--color-surface-base)] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:ring-offset-2 focus:ring-offset-[var(--color-surface-base)]"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-12">
        {/* TAB NAVIGATION */}
        <div className="flex gap-2 border-b border-[var(--color-neutral-800)]">
          {(['overview', 'appointments', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-3 font-medium text-sm transition-all duration-200 relative focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 rounded-t-lg ${
                selectedTab === tab
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-200)]'
              }`}
              aria-selected={selectedTab === tab}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {selectedTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {selectedTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-12"
          >
            {/* KPI GRID - UI/UX Pro Max Priority 5: Responsive grid */}
            <div>
              <SectionHeader
                title="Key Metrics"
                description="Real-time performance indicators"
              />
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
                    <KPICard 
                      key={kpi.label} 
                      data={kpi} 
                      // Revenue Overview opens modal, others are active buttons (placeholder action for now)
                      onClick={kpi.label === 'Revenue Overview' 
                        ? () => setShowRevenueOverview(true) 
                        : () => console.log(`${kpi.label} clicked`)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* TODAY'S APPOINTMENTS */}
            <div>
              <SectionHeader
                title="Today's Appointments"
                description="12 appointments scheduled"
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
                  {mockAppointments.map((apt) => (
                    <AppointmentRow key={apt.id} appointment={apt} />
                  ))}
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div>
              <SectionHeader
                title="Quick Actions"
                description="Common tasks"
              />
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
                  onClick={() => setSelectedTab('appointments')}
                  className="flex items-center justify-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-neutral-700)] rounded-xl hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-floating)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
                  aria-label="View All Appointments"
                >
                  <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="font-medium text-[var(--color-neutral-100)]">View All Appointments</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* APPOINTMENTS TAB - Redirect to full appointments page */}
        {selectedTab === 'appointments' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12"
          >
            <p className="text-[var(--color-neutral-400)] mb-4">Opening full appointments view...</p>
            {setTimeout(() => navigate('/owner/appointments'), 100) && null}
          </motion.div>
        )}

        {/* ANALYTICS TAB - Redirect to analytics page */}
        {selectedTab === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12"
          >
            <p className="text-[var(--color-neutral-400)] mb-4">Opening analytics dashboard...</p>
            {setTimeout(() => navigate('/analytics'), 100) && null}
          </motion.div>
        )}
      </main>

      {/* REVENUE OVERVIEW MODAL */}
      <RevenueOverviewModal
        isOpen={showRevenueOverview}
        onClose={() => setShowRevenueOverview(false)}
        revenueByService={kpiData?.revenue_by_service || []}
        totalRevenue={kpiData?.total_revenue || 0}
      />
    </div>
  );
}
