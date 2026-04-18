/**
 * Analytics Page
 *
 * Comprehensive analytics dashboard with revenue, appointments, staff, and customer insights
 * Route: /analytics
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Filter } from 'lucide-react';
import { useRevenueTrends, useRevenueByService, useAppointmentsByDayOfWeek, useAppointmentsByHour, useStatusBreakdown, useCancellationRate, useStaffUtilization, useNewVsRepeatCustomers, useLifetimeValueDistribution } from '../hooks/useAnalytics';
import { RevenueTrendsChart, RevenueByServiceChart } from '../components/analytics/RevenueChart';
import { AppointmentsByDayChart, AppointmentsByHourChart, StatusBreakdownChart, CancellationRateCard } from '../components/analytics/AppointmentAnalytics';
import { StaffUtilizationChart, NewVsRepeatChart, LifetimeValueChart } from '../components/analytics/StaffAnalytics';

// ============================================================================
// Date Range Options
// ============================================================================

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 180 days', value: 180 },
  { label: 'Last 365 days', value: 365 },
];

// ============================================================================
// Loading State
// ============================================================================

const AnalyticsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-16 bg-neutral-200 rounded-xl" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 bg-neutral-200 rounded-2xl" />
      <div className="h-80 bg-neutral-200 rounded-2xl" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 bg-neutral-200 rounded-2xl" />
      <div className="h-80 bg-neutral-200 rounded-2xl" />
    </div>
  </div>
);

// ============================================================================
// Error State
// ============================================================================

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Failed to load analytics</h3>
    <p className="text-neutral-500 mb-4 max-w-md">{message}</p>
    <button onClick={onRetry} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
      Try Again
    </button>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export default function Analytics() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState(30);

  // Fetch analytics data
  const { data: revenueTrends, isLoading: revenueTrendsLoading, error: revenueTrendsError, refetch: refetchRevenueTrends } = useRevenueTrends(dateRange);
  const { data: revenueByService, isLoading: revenueByServiceLoading, error: revenueByServiceError, refetch: refetchRevenueByService } = useRevenueByService(dateRange);
  const { data: appointmentsByDay, isLoading: appointmentsByDayLoading, error: appointmentsByDayError, refetch: refetchAppointmentsByDay } = useAppointmentsByDayOfWeek(dateRange);
  const { data: appointmentsByHour, isLoading: appointmentsByHourLoading, error: appointmentsByHourError, refetch: refetchAppointmentsByHour } = useAppointmentsByHour(dateRange);
  const { data: statusBreakdown, isLoading: statusBreakdownLoading, error: statusBreakdownError, refetch: refetchStatusBreakdown } = useStatusBreakdown(dateRange);
  const { data: cancellationRate, isLoading: cancellationRateLoading, error: cancellationRateError, refetch: refetchCancellationRate } = useCancellationRate(dateRange);
  const { data: staffUtilization, isLoading: staffUtilizationLoading, error: staffUtilizationError, refetch: refetchStaffUtilization } = useStaffUtilization(dateRange);
  const { data: newVsRepeat, isLoading: newVsRepeatLoading, error: newVsRepeatError, refetch: refetchNewVsRepeat } = useNewVsRepeatCustomers(dateRange);
  const { data: ltvDistribution, isLoading: ltvDistributionLoading, error: ltvDistributionError, refetch: refetchLtvDistribution } = useLifetimeValueDistribution();

  const isLoading = revenueTrendsLoading || revenueByServiceLoading || appointmentsByDayLoading || appointmentsByHourLoading || statusBreakdownLoading || cancellationRateLoading || staffUtilizationLoading || newVsRepeatLoading || ltvDistributionLoading;
  const error = revenueTrendsError || revenueByServiceError || appointmentsByDayError || appointmentsByHourError || statusBreakdownError || cancellationRateError || staffUtilizationError || newVsRepeatError || ltvDistributionError;

  const handleRetry = () => {
    refetchRevenueTrends();
    refetchRevenueByService();
    refetchAppointmentsByDay();
    refetchAppointmentsByHour();
    refetchStatusBreakdown();
    refetchCancellationRate();
    refetchStaffUtilization();
    refetchNewVsRepeat();
    refetchLtvDistribution();
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export analytics data');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50 flex items-center justify-center">
        <ErrorState message={(error as Error).message || 'Failed to load analytics data'} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={2} />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Page title */}
            <h1 className="text-lg font-bold text-neutral-900">Analytics Dashboard</h1>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
                aria-label="Export data"
              >
                <Download className="w-4 h-4" strokeWidth={2} />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-neutral-500" strokeWidth={2} />
            <span className="text-sm font-medium text-neutral-700">Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  dateRange === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {isLoading ? (
          <AnalyticsSkeleton />
        ) : (
          <div className="space-y-6">
            {/* Revenue Section */}
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Revenue Analytics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RevenueTrendsChart data={revenueTrends!} />
                <RevenueByServiceChart data={revenueByService!} />
              </div>
            </section>

            {/* Appointments Section */}
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Appointment Analytics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <AppointmentsByDayChart data={appointmentsByDay!} />
                </div>
                <div>
                  <CancellationRateCard data={cancellationRate!} />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <AppointmentsByHourChart data={appointmentsByHour!} />
                <StatusBreakdownChart data={statusBreakdown!} />
              </div>
            </section>

            {/* Staff & Customer Section */}
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Staff & Customer Analytics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StaffUtilizationChart data={staffUtilization!} />
                <NewVsRepeatChart data={newVsRepeat!} />
              </div>
              <div className="mt-6">
                <LifetimeValueChart data={ltvDistribution!} />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
