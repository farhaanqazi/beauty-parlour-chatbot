/**
 * Reports Page
 *
 * Generate and export analytics reports in CSV format
 * Route: /reports
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Table, Users, DollarSign, Calendar, Star } from 'lucide-react';
import {
  generateRevenueReport,
  generateAppointmentsReport,
  generateStaffReport,
  generateCustomerReport,
  generateFullAnalyticsReport,
} from '../utils/reportGenerator';
import {
  useRevenueTrends,
  useRevenueByService,
  useAppointmentsByDayOfWeek,
  useAppointmentsByHour,
  useStatusBreakdown,
  useCancellationRate,
  useStaffUtilization,
  useNewVsRepeatCustomers,
  useLifetimeValueDistribution,
} from '../hooks/useAnalytics';

// ============================================================================
// Report Type Definition
// ============================================================================

interface ReportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'revenue',
    title: 'Revenue Report',
    description: 'Revenue trends and breakdown by service',
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'appointments',
    title: 'Appointments Report',
    description: 'Appointment analytics, peak times, and status breakdown',
    icon: Calendar,
    color: 'blue',
  },
  {
    id: 'staff',
    title: 'Staff Performance Report',
    description: 'Staff utilization and revenue generated',
    icon: Users,
    color: 'indigo',
  },
  {
    id: 'customers',
    title: 'Customer Analytics Report',
    description: 'Customer retention and lifetime value distribution',
    icon: Star,
    color: 'amber',
  },
  {
    id: 'full',
    title: 'Complete Analytics Report',
    description: 'All analytics data in a single comprehensive report',
    icon: FileText,
    color: 'purple',
  },
];

// ============================================================================
// Loading State
// ============================================================================

const ReportsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-16 bg-neutral-200 rounded-xl" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-40 bg-neutral-200 rounded-2xl" />
      ))}
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export default function Reports() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState(30);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  // Fetch analytics data
  const { data: revenueTrends, isLoading: revenueTrendsLoading } = useRevenueTrends(dateRange);
  const { data: revenueByService, isLoading: revenueByServiceLoading } = useRevenueByService(dateRange);
  const { data: appointmentsByDay, isLoading: appointmentsByDayLoading } = useAppointmentsByDayOfWeek(dateRange);
  const { data: appointmentsByHour, isLoading: appointmentsByHourLoading } = useAppointmentsByHour(dateRange);
  const { data: statusBreakdown, isLoading: statusBreakdownLoading } = useStatusBreakdown(dateRange);
  const { data: cancellationRate, isLoading: cancellationRateLoading } = useCancellationRate(dateRange);
  const { data: staffUtilization, isLoading: staffUtilizationLoading } = useStaffUtilization(dateRange);
  const { data: newVsRepeat, isLoading: newVsRepeatLoading } = useNewVsRepeatCustomers(dateRange);
  const { data: ltvDistribution, isLoading: ltvDistributionLoading } = useLifetimeValueDistribution();

  const isLoading = revenueTrendsLoading || revenueByServiceLoading || appointmentsByDayLoading ||
    appointmentsByHourLoading || statusBreakdownLoading || cancellationRateLoading ||
    staffUtilizationLoading || newVsRepeatLoading || ltvDistributionLoading;

  const handleBack = () => {
    navigate(-1);
  };

  const handleGenerateReport = async (reportType: string) => {
    setGeneratingReport(reportType);

    // Simulate a small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      switch (reportType) {
        case 'revenue':
          if (revenueTrends && revenueByService) {
            generateRevenueReport(revenueTrends, revenueByService);
          }
          break;
        case 'appointments':
          if (appointmentsByDay && appointmentsByHour && statusBreakdown && cancellationRate) {
            generateAppointmentsReport({
              byDay: appointmentsByDay.data,
              byHour: appointmentsByHour.data,
              status: statusBreakdown.data,
              cancellation: cancellationRate,
            });
          }
          break;
        case 'staff':
          if (staffUtilization) {
            generateStaffReport(staffUtilization);
          }
          break;
        case 'customers':
          if (newVsRepeat && ltvDistribution) {
            generateCustomerReport({
              newVsRepeat,
              ltvDistribution,
            });
          }
          break;
        case 'full':
          if (revenueTrends && revenueByService && appointmentsByDay && appointmentsByHour &&
              statusBreakdown && cancellationRate && staffUtilization && newVsRepeat && ltvDistribution) {
            generateFullAnalyticsReport({
              revenue: {
                trends: revenueTrends,
                byService: revenueByService,
              },
              appointments: {
                byDay: appointmentsByDay.data,
                byHour: appointmentsByHour.data,
                status: statusBreakdown.data,
                cancellation: cancellationRate,
              },
              staff: staffUtilization,
              customers: {
                newVsRepeat,
                ltvDistribution,
              },
            });
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGeneratingReport(null);
    }
  };

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
            <h1 className="text-lg font-bold text-neutral-900">Reports & Export</h1>

            {/* Empty div for layout balance */}
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-neutral-500" strokeWidth={2} />
            <span className="text-sm font-medium text-neutral-700">Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90, 180, 365].map((days) => (
              <button
                key={days}
                onClick={() => setDateRange(days)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  dateRange === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {isLoading ? (
          <ReportsSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {REPORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isGenerating = generatingReport === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleGenerateReport(option.id)}
                  disabled={isGenerating}
                  className={`
                    relative bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm
                    hover:shadow-lg hover:border-blue-300 transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    group text-left
                  `}
                  aria-label={`Generate ${option.title}`}
                >
                  {/* Icon */}
                  <div
                    className={`
                      w-14 h-14 rounded-xl flex items-center justify-center mb-4
                      transition-colors group-hover:scale-110
                    `}
                    style={{
                      backgroundColor: `var(--${option.color}-50, #f0f9ff)`,
                    }}
                  >
                    <Icon
                      className={`w-7 h-7`}
                      strokeWidth={2}
                      style={{
                        color: `var(--${option.color}-600, #0284c7)`,
                      }}
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">{option.title}</h3>
                  <p className="text-sm text-neutral-500 mb-4">{option.description}</p>

                  {/* Action */}
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: `var(--${option.color}-600, #0284c7)` }}>
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" strokeWidth={2} />
                        <span>Download CSV</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-2">About Reports</h3>
            <p className="text-sm text-blue-700 mb-4">
              All reports are generated in CSV format and can be opened in Excel, Google Sheets, or any spreadsheet application.
              The data reflects the selected date range and includes real-time information from your salon's database.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-blue-600">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" strokeWidth={2} />
                <span>Instant download</span>
              </div>
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4" strokeWidth={2} />
                <span>Excel-compatible CSV</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" strokeWidth={2} />
                <span>Customizable date range</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
