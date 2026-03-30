/**
 * Staff Analytics Component
 *
 * Displays staff utilization and customer analytics using pure Tailwind CSS
 * Following the existing DashboardRedesigned.tsx patterns
 */

import { Users, UserCheck, TrendingUp } from 'lucide-react';
import type {
  StaffUtilizationResponse,
  NewVsRepeatCustomersResponse,
  LifetimeValueDistributionResponse,
} from '../../services/analyticsApi';

// ============================================================================
// Loading Skeleton
// ============================================================================

export const StaffAnalyticsSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="w-48 h-6 bg-neutral-200 rounded mb-6" />
    <div className="h-64 bg-neutral-100 rounded-xl" />
  </div>
);

// ============================================================================
// Staff Utilization Chart (Horizontal Bars)
// ============================================================================

interface StaffUtilizationChartProps {
  data: StaffUtilizationResponse;
}

export const StaffUtilizationChart = ({ data }: StaffUtilizationChartProps) => {
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
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Staff Utilization</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No staff data available</p>
        </div>
      </div>
    );
  }

  // Sort by appointment count and take top 10
  const topStaff = [...data.data]
    .sort((a, b) => b.appointment_count - a.appointment_count)
    .slice(0, 10);

  const maxAppointments = Math.max(...topStaff.map((s) => s.appointment_count), 1);

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Staff Utilization</h3>
          <p className="text-sm text-neutral-500 mt-0.5">Top performers by appointments</p>
        </div>
        <Users className="w-8 h-8 text-indigo-600" strokeWidth={2} />
      </div>

      {/* Horizontal bars */}
      <div className="space-y-4">
        {topStaff.map((staff) => {
          const widthPercent = (staff.appointment_count / maxAppointments) * 100;
          const initials = staff.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

          return (
            <div key={staff.user_id} className="space-y-1">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                  {initials}
                </div>
                {/* Name & bars */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-neutral-900">{staff.name}</span>
                    <span className="text-sm font-semibold text-neutral-700">
                      {staff.appointment_count} appts
                    </span>
                  </div>
                  <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                      role="img"
                      aria-label={`${staff.appointment_count} appointments`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff details table */}
      <div className="mt-6 border-t border-neutral-200 pt-4">
        <h4 className="text-sm font-semibold text-neutral-700 mb-3">Revenue Generated</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-200">
                <th className="pb-2 font-medium">Staff Member</th>
                <th className="pb-2 font-medium">Appointments</th>
                <th className="pb-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topStaff.map((staff) => (
                <tr key={staff.user_id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 font-medium text-neutral-900">{staff.name}</td>
                  <td className="py-3 text-neutral-600">{staff.appointment_count}</td>
                  <td className="py-3 font-semibold text-emerald-600 text-right">
                    {formatCurrency(staff.revenue_generated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// New vs Repeat Customers (Donut Chart - Pure CSS)
// ============================================================================

interface NewVsRepeatChartProps {
  data: NewVsRepeatCustomersResponse;
}

export const NewVsRepeatChart = ({ data }: NewVsRepeatChartProps) => {
  const total = data.new_customers + data.repeat_customers;

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Customer Retention</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <UserCheck className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No customer data available</p>
        </div>
      </div>
    );
  }

  const newPercentage = Math.round((data.new_customers / total) * 100);
  const repeatPercentage = Math.round((data.repeat_customers / total) * 100);

  // Calculate conic gradient for donut chart
  const gradient = `conic-gradient(#10b981 0% ${newPercentage}%, #3b82f6 ${newPercentage}% 100%)`;

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Customer Retention</h3>
          <p className="text-sm text-neutral-500 mt-0.5">New vs repeat customers</p>
        </div>
        <UserCheck className="w-8 h-8 text-emerald-600" strokeWidth={2} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Donut Chart - Pure CSS */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-48 h-48">
            {/* Outer ring with gradient */}
            <div
              className="w-full h-full rounded-full"
              style={{ background: gradient }}
              role="img"
              aria-label={`${newPercentage}% new customers, ${repeatPercentage}% repeat customers`}
            />
            {/* Inner circle (creates donut) */}
            <div className="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-neutral-900" style={{ fontFamily: 'Fira Code, monospace' }}>
                  {total}
                </p>
                <p className="text-xs text-neutral-500">Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-900">New Customers</span>
            </div>
            <p className="text-3xl font-bold text-emerald-700" style={{ fontFamily: 'Fira Code, monospace' }}>
              {data.new_customers}
            </p>
            <p className="text-sm text-emerald-600 mt-1">{newPercentage}% of total</p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-blue-900">Repeat Customers</span>
            </div>
            <p className="text-3xl font-bold text-blue-700" style={{ fontFamily: 'Fira Code, monospace' }}>
              {data.repeat_customers}
            </p>
            <p className="text-sm text-blue-600 mt-1">{repeatPercentage}% of total</p>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="mt-6 p-4 bg-neutral-50 rounded-xl text-center">
        <p className="text-sm text-neutral-500 mb-1">Total Customers</p>
        <p className="text-2xl font-bold text-neutral-900">{total}</p>
      </div>
    </div>
  );
};

// ============================================================================
// Lifetime Value Distribution (Horizontal Bars)
// ============================================================================

interface LifetimeValueChartProps {
  data: LifetimeValueDistributionResponse;
}

export const LifetimeValueChart = ({ data }: LifetimeValueChartProps) => {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">Lifetime Value Distribution</h3>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <TrendingUp className="w-16 h-16 text-neutral-300 mb-4" strokeWidth={1.5} />
          <p className="text-neutral-500">No lifetime value data available</p>
        </div>
      </div>
    );
  }

  const totalCustomers = data.data.reduce((a, b) => a + b.count, 0);

  const colors = [
    'from-neutral-400 to-neutral-500',
    'from-emerald-400 to-emerald-500',
    'from-blue-400 to-blue-500',
    'from-violet-400 to-violet-500',
    'from-amber-400 to-amber-500',
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">Lifetime Value Distribution</h3>
          <p className="text-sm text-neutral-500 mt-0.5">Customer value segments</p>
        </div>
        <TrendingUp className="w-8 h-8 text-amber-600" strokeWidth={2} />
      </div>

      {/* Horizontal bars */}
      <div className="space-y-4">
        {data.data.map((item, index) => {
          const widthPercent = totalCustomers > 0 ? (item.count / totalCustomers) * 100 : 0;
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-700">{item.range}</span>
                <span className="text-sm font-semibold text-neutral-900">{item.count}</span>
              </div>
              <div className="h-4 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${colors[index]} transition-all duration-500`}
                  style={{ width: `${widthPercent}%` }}
                  role="img"
                  aria-label={`${item.count} customers in ${item.range} range`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="p-4 bg-neutral-50 rounded-xl">
          <p className="text-sm text-neutral-500 mb-1">Total Customers</p>
          <p className="text-xl font-bold text-neutral-900">{totalCustomers}</p>
        </div>
        <div className="p-4 bg-neutral-50 rounded-xl">
          <p className="text-sm text-neutral-500 mb-1">High Value ($500+)</p>
          <p className="text-xl font-bold text-amber-600">
            {data.data
              .filter((d) => d.range === '$500-$999' || d.range === '$1000+')
              .reduce((a, b) => a + b.count, 0)}
          </p>
        </div>
      </div>
    </div>
  );
};
