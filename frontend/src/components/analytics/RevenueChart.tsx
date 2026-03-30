/**
 * Revenue Chart Component
 *
 * Displays revenue trends over time using pure Tailwind CSS
 * Following the existing DashboardRedesigned.tsx patterns
 */

import { TrendingUp, DollarSign } from 'lucide-react';
import type { RevenueTrendsResponse, RevenueByServiceResponse } from '../../services/analyticsApi';

// ============================================================================
// Loading Skeleton
// ============================================================================

export const RevenueChartSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="flex items-center justify-between mb-6">
      <div className="w-48 h-6 bg-neutral-200 rounded" />
      <div className="w-32 h-8 bg-neutral-200 rounded" />
    </div>
    <div className="h-64 bg-neutral-100 rounded-xl" />
  </div>
);

// ============================================================================
// Revenue Trends Chart (Bar Chart - Pure Tailwind)
// ============================================================================

interface RevenueTrendsChartProps {
  data: RevenueTrendsResponse;
}

export const RevenueTrendsChart = ({ data }: RevenueTrendsChartProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Prepare data for chart (last 14 days max)
  const chartData = data.data.slice(-14);
  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-neutral-900">Revenue Trends</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <DollarSign className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No revenue data available for this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Revenue Trends</h3>
          <p className="text-sm text-neutral-500 mt-0.5">
            {formatCurrency(data.total_revenue)} total revenue
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
          <TrendingUp className="w-4 h-4" strokeWidth={2} />
          <span className="text-sm font-medium">{data.data.length} days</span>
        </div>
      </div>

      {/* Bar Chart - Pure Tailwind */}
      <div className="h-64 flex items-end gap-2">
        {chartData.map((item, index) => {
          const heightPercent = (item.revenue / maxRevenue) * 100;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-12 bg-neutral-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {formatCurrency(item.revenue)}
              </div>
              {/* Bar */}
              <div
                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-300 hover:from-blue-700 hover:to-blue-500"
                style={{ height: `${heightPercent}%` }}
                role="img"
                aria-label={`${formatCurrency(item.revenue)} on ${formatDate(item.date)}`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex-1 text-center">
            <span className="text-xs text-neutral-500 rotate-0">
              {formatDate(item.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Revenue by Service (Horizontal Bar Chart - Pure Tailwind)
// ============================================================================

interface RevenueByServiceChartProps {
  data: RevenueByServiceResponse;
}

export const RevenueByServiceChart = ({ data }: RevenueByServiceChartProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Revenue by Service</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <DollarSign className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No service revenue data available</p>
        </div>
      </div>
    );
  }

  // Sort by revenue and take top 8
  const sortedData = [...data.data]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const maxRevenue = Math.max(...sortedData.map((d) => d.revenue), 1);

  const colors = [
    'from-blue-600 to-blue-400',
    'from-violet-600 to-violet-400',
    'from-pink-600 to-pink-400',
    'from-amber-600 to-amber-400',
    'from-emerald-600 to-emerald-400',
    'from-cyan-600 to-cyan-400',
    'from-indigo-600 to-indigo-400',
    'from-rose-600 to-rose-400',
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <h3 className="text-lg font-bold text-neutral-900 mb-6">Revenue by Service</h3>

      {/* Horizontal Bars */}
      <div className="space-y-4">
        {sortedData.map((item, index) => {
          const widthPercent = (item.revenue / maxRevenue) * 100;
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-700 truncate max-w-[200px]">
                  {item.service}
                </span>
                <span className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
              <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${colors[index % colors.length]} transition-all duration-500`}
                  style={{ width: `${widthPercent}%` }}
                  role="img"
                  aria-label={`${formatCurrency(item.revenue)} revenue`}
                />
              </div>
              <div className="text-xs text-neutral-500">{item.count} bookings</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
