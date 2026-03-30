/**
 * Appointment Analytics Component
 *
 * Displays appointment distribution analytics using pure Tailwind CSS
 * Following the existing DashboardRedesigned.tsx patterns
 */

import { Calendar, Clock, AlertCircle, TrendingDown } from 'lucide-react';
import type {
  AppointmentsByDayResponse,
  AppointmentsByHourResponse,
  StatusBreakdownResponse,
  CancellationRateResponse,
} from '../../services/analyticsApi';

// ============================================================================
// Loading Skeleton
// ============================================================================

export const AppointmentAnalyticsSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="w-48 h-6 bg-neutral-200 rounded mb-6" />
    <div className="h-64 bg-neutral-100 rounded-xl" />
  </div>
);

// ============================================================================
// Appointments by Day of Week (Vertical Bar Chart)
// ============================================================================

interface AppointmentsByDayChartProps {
  data: AppointmentsByDayResponse;
}

export const AppointmentsByDayChart = ({ data }: AppointmentsByDayChartProps) => {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Appointments by Day</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Calendar className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No appointment data available</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.data.map((d) => d.count), 1);
  const totalAppointments = data.data.reduce((a, b) => a + b.count, 0);

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Appointments by Day</h3>
          <p className="text-sm text-neutral-500 mt-0.5">
            {totalAppointments} total appointments
          </p>
        </div>
        <Calendar className="w-8 h-8 text-blue-600" strokeWidth={2} />
      </div>

      {/* Vertical Bar Chart */}
      <div className="h-64 flex items-end gap-3">
        {data.data.map((item, index) => {
          const heightPercent = (item.count / maxCount) * 100;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-10 bg-neutral-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {item.count} appointments
              </div>
              {/* Bar */}
              <div
                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-300 hover:from-blue-700 hover:to-blue-500"
                style={{ height: `${heightPercent}%` }}
                role="img"
                aria-label={`${item.count} appointments on ${item.day}`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        {data.data.map((item, index) => (
          <div key={index} className="flex-1 text-center">
            <span className="text-xs text-neutral-500 font-medium">
              {item.day.substring(0, 3)}
            </span>
          </div>
        ))}
      </div>

      {/* Peak day highlight */}
      {maxCount > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Busiest day:</span>{' '}
            {data.data.find((d) => d.count === maxCount)?.day} with {maxCount} appointments
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Appointments by Hour (Heatmap-style Horizontal Bars)
// ============================================================================

interface AppointmentsByHourChartProps {
  data: AppointmentsByHourResponse;
}

export const AppointmentsByHourChart = ({ data }: AppointmentsByHourChartProps) => {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Peak Hours</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Clock className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No hourly data available</p>
        </div>
      </div>
    );
  }

  // Filter to business hours (8 AM - 8 PM)
  const businessHoursData = data.data.filter((d) => d.hour >= 8 && d.hour <= 20);
  const maxCount = Math.max(...businessHoursData.map((d) => d.count), 1);

  const getIntensityColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return 'bg-blue-600';
    if (ratio > 0.6) return 'bg-blue-500';
    if (ratio > 0.4) return 'bg-blue-400';
    if (ratio > 0.2) return 'bg-blue-300';
    return 'bg-blue-200';
  };

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${ampm}`;
  };

  // Find peak hour
  const peakHour = businessHoursData.reduce(
    (max, d) => (d.count > max.count ? d : max),
    businessHoursData[0]
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Peak Hours</h3>
          <p className="text-sm text-neutral-500 mt-0.5">Business hours distribution</p>
        </div>
        <Clock className="w-8 h-8 text-amber-600" strokeWidth={2} />
      </div>

      {/* Hourly bars */}
      <div className="space-y-2">
        {businessHoursData.map((item) => (
          <div key={item.hour} className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 w-14 text-right font-medium">
              {formatHour(item.hour)}
            </span>
            <div className="flex-1 h-8 bg-neutral-100 rounded-md overflow-hidden">
              <div
                className={`h-full ${getIntensityColor(item.count)} transition-all duration-300`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
                role="img"
                aria-label={`${item.count} appointments at ${formatHour(item.hour)}`}
              />
            </div>
            <span className="text-sm font-semibold text-neutral-700 w-8 text-right">
              {item.count}
            </span>
          </div>
        ))}
      </div>

      {/* Peak hour highlight */}
      {peakHour && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Peak hour:</span>{' '}
            {formatHour(peakHour.hour)} with {peakHour.count} appointments
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Status Breakdown (Horizontal Bars with Percentages)
// ============================================================================

interface StatusBreakdownChartProps {
  data: StatusBreakdownResponse;
}

export const StatusBreakdownChart = ({ data }: StatusBreakdownChartProps) => {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Status Breakdown</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No status data available</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-500',
    pending: 'bg-amber-500',
    completed: 'bg-blue-500',
    cancelled_by_client: 'bg-rose-500',
    cancelled_by_salon: 'bg-rose-500',
    cancelled_by_reception: 'bg-rose-500',
    cancelled_by_user: 'bg-rose-500',
    cancelled_closure: 'bg-rose-500',
    no_show: 'bg-neutral-400',
  };

  const totalAppointments = data.data.reduce((a, b) => a + b.count, 0);

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-neutral-900">Status Breakdown</h3>
        <AlertCircle className="w-8 h-8 text-purple-600" strokeWidth={2} />
      </div>

      {/* Status bars */}
      <div className="space-y-4">
        {data.data.map((item, index) => {
          const percentage = totalAppointments > 0 ? (item.count / totalAppointments) * 100 : 0;
          const statusLabel = item.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-700">{statusLabel}</span>
                <span className="text-sm font-semibold text-neutral-900">
                  {item.count} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${statusColors[item.status] || 'bg-neutral-400'} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                  role="img"
                  aria-label={`${statusLabel}: ${item.count} appointments`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Cancellation Rate Card
// ============================================================================

interface CancellationRateCardProps {
  data: CancellationRateResponse;
}

export const CancellationRateCard = ({ data }: CancellationRateCardProps) => {
  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-neutral-900">Cancellation Analytics</h3>
        <TrendingDown className="w-8 h-8 text-rose-600" strokeWidth={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-neutral-50 rounded-xl">
          <p className="text-sm text-neutral-500 mb-1">Cancellation Rate</p>
          <p className="text-2xl font-bold text-neutral-900" style={{ fontFamily: 'Fira Code, monospace' }}>
            {data.cancellation_rate}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">{data.cancelled} cancelled</p>
        </div>

        <div className="p-4 bg-neutral-50 rounded-xl">
          <p className="text-sm text-neutral-500 mb-1">No-Show Rate</p>
          <p className="text-2xl font-bold text-neutral-900" style={{ fontFamily: 'Fira Code, monospace' }}>
            {data.no_show_rate}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">{data.no_shows} no-shows</p>
        </div>
      </div>

      <div className="mt-4 p-4 bg-neutral-50 rounded-xl">
        <p className="text-sm text-neutral-500 mb-1">Total Appointments</p>
        <p className="text-xl font-bold text-neutral-900">{data.total_appointments}</p>
      </div>
    </div>
  );
};
