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
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTodayAppointments } from '../hooks/useDashboardData';
import AppointmentDrawer from '../components/appointments/AppointmentDrawer';
import RevenueOverviewModal from '../components/dashboard/RevenueOverviewModal';
import AnalyticsWeeklyDrawer from '../components/dashboard/AnalyticsWeeklyDrawer';
import { useSalonKpis } from '../components/dashboard/hooks/useSalonKpis';
import { useWeeklyBookings } from '../components/dashboard/hooks/useWeeklyBookings';
import { useSelectedWeek } from '../components/dashboard/hooks/useSelectedWeek';
import AnalyticsTab from '../components/dashboard/AnalyticsTab';
import OverviewTab from '../components/dashboard/OverviewTab';

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
  const [showAnalyticsDrawer, setShowAnalyticsDrawer] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const weeklySalonId = user?.salon_id || undefined;

  const { data: kpiData, isLoading: kpisLoading, error: kpiError } = useSalonKpis();
  const { data: todayAppointments, isLoading: appointmentsLoading } = useTodayAppointments();
  const {
    thisWeekTrend,
    priorWeekTrend,
    analytics: weeklyAnalytics,
    loading: loadingWeekly,
  } = useWeeklyBookings(weeklySalonId);
  const {
    weekOffset,
    setWeekOffset,
    weekRange,
    selectedWeekTrend,
    loadingSelectedWeek,
    delta: selectedWeekDelta,
  } = useSelectedWeek({ enabled: selectedTab === 'analytics', salonId: weeklySalonId });

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

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)] text-[var(--color-neutral-100)]">
      {/* Page title bar */}
      <div className="border-b border-[var(--color-neutral-800)] px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold">Salon Owner Dashboard</h1>
          <p className="text-[var(--color-neutral-400)] text-sm mt-0.5">
            Welcome back, {user?.full_name}
          </p>
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
          <OverviewTab
            kpiData={kpiData}
            kpisLoading={kpisLoading}
            kpiError={kpiError}
            weeklyAnalytics={weeklyAnalytics}
            loadingWeekly={loadingWeekly}
            todayAppointments={todayAppointments}
            appointmentsLoading={appointmentsLoading}
            onShowRevenueOverview={() => setShowRevenueOverview(true)}
            onJumpToAnalytics={() => setSelectedTab('analytics')}
            onJumpToAppointments={() => setSelectedTab('appointments')}
            onOpenAppointment={setSelectedAppointment}
          />
        )}

        {/* APPOINTMENTS TAB - Full appointments management */}
        {selectedTab === 'appointments' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--color-neutral-100)] mb-2">
                Appointments Management
              </h3>
              <p className="text-[var(--color-neutral-400)] mb-6">
                View and manage all your appointments
              </p>
              <button
                onClick={() => navigate('/owner/appointments')}
                className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-surface-base)] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Open Full Appointments View
              </button>
            </div>
          </motion.div>
        )}

        {/* ANALYTICS TAB */}
        {selectedTab === 'analytics' && (
          <AnalyticsTab
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            weekRange={weekRange}
            selectedWeekTrend={selectedWeekTrend}
            loadingSelectedWeek={loadingSelectedWeek}
            selectedWeekDelta={selectedWeekDelta}
          />
        )}
      </main>

      {/* REVENUE OVERVIEW MODAL */}
      <RevenueOverviewModal
        isOpen={showRevenueOverview}
        onClose={() => setShowRevenueOverview(false)}
        revenueByService={kpiData?.revenue_by_service || []}
        totalRevenue={kpiData?.total_revenue || 0}
      />

      <AnalyticsWeeklyDrawer
        isOpen={showAnalyticsDrawer}
        onClose={() => setShowAnalyticsDrawer(false)}
        thisWeek={thisWeekTrend?.data || []}
        priorWeek={priorWeekTrend?.data || []}
        thisCount={weeklyAnalytics.thisCount}
        priorCount={weeklyAnalytics.priorCount}
        delta={weeklyAnalytics.delta}
        trend={weeklyAnalytics.trend}
        onOpenFullAnalytics={() => setSelectedTab('analytics')}
      />

      <AppointmentDrawer
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
