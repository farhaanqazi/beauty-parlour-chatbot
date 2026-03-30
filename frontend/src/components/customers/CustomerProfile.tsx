/**
 * Customer Profile Component
 *
 * Displays customer profile information and lifetime metrics
 */

import {
  User,
  Phone,
  Calendar,
  DollarSign,
  Star,
  MessageCircle,
  Globe,
  Hash
} from 'lucide-react';
import type { Customer } from '../../services/customerApi';

// ============================================================================
// Loading Skeleton
// ============================================================================

export const CustomerProfileSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="flex items-start gap-4 mb-6">
      <div className="w-20 h-20 bg-neutral-200 rounded-full" />
      <div className="flex-1 space-y-3">
        <div className="w-48 h-6 bg-neutral-200 rounded" />
        <div className="w-32 h-4 bg-neutral-200 rounded" />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-neutral-50 rounded-xl p-4">
          <div className="w-8 h-8 bg-neutral-200 rounded-lg mb-3" />
          <div className="w-24 h-4 bg-neutral-200 rounded mb-2" />
          <div className="w-16 h-6 bg-neutral-200 rounded" />
        </div>
      ))}
    </div>

    <div className="space-y-3">
      <div className="w-32 h-5 bg-neutral-200 rounded" />
      <div className="w-full h-10 bg-neutral-200 rounded" />
      <div className="w-full h-10 bg-neutral-200 rounded" />
    </div>
  </div>
);

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}

const MetricCard = ({ icon: Icon, label, value, color = 'blue' }: MetricCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-neutral-50 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
      </div>
      <p className="text-sm text-neutral-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-neutral-900" style={{ fontFamily: 'Fira Code, monospace' }}>
        {value}
      </p>
    </div>
  );
};

// ============================================================================
// Info Row Component
// ============================================================================

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  emptyValue?: string;
}

const InfoRow = ({ icon: Icon, label, value, emptyValue = 'Not provided' }: InfoRowProps) => (
  <div className="flex items-start gap-3 py-3 border-b border-neutral-100 last:border-0">
    <Icon className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
    <div className="flex-1 min-w-0">
      <p className="text-sm text-neutral-500 mb-0.5">{label}</p>
      <p className="text-base text-neutral-900 font-medium truncate">
        {value || emptyValue}
      </p>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

interface CustomerProfileProps {
  customer: Customer;
}

export const CustomerProfile = ({ customer }: CustomerProfileProps) => {
  const { metrics } = customer;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get initials for avatar
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
      {/* Header with Avatar */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500
                     flex items-center justify-center text-white text-2xl font-bold
                     shadow-lg shadow-blue-500/30"
          aria-label={`Profile picture for ${customer.display_name || 'Customer'}`}
        >
          {getInitials(customer.display_name)}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">
            {customer.display_name || 'Unnamed Customer'}
          </h2>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Calendar className="w-4 h-4" strokeWidth={2} />
            <span>Customer since {formatDate(customer.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Lifetime Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard
          icon={Calendar}
          label="Total Visits"
          value={metrics.total_visits}
          color="blue"
        />
        <MetricCard
          icon={DollarSign}
          label="Lifetime Value"
          value={formatCurrency(metrics.total_spent)}
          color="green"
        />
        <MetricCard
          icon={Star}
          label="Last Visit"
          value={formatDate(metrics.last_visit)}
          color="amber"
        />
      </div>

      {/* Contact Information */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
          Contact Information
        </h3>

        <InfoRow
          icon={Phone}
          label="Phone Number"
          value={customer.phone_number}
        />
        <InfoRow
          icon={MessageCircle}
          label="Telegram Chat ID"
          value={customer.telegram_chat_id}
        />
        <InfoRow
          icon={Hash}
          label="External User ID"
          value={customer.external_user_id}
        />
        <InfoRow
          icon={Globe}
          label="Preferred Language"
          value={customer.preferred_language}
        />
        <InfoRow
          icon={User}
          label="Channel"
          value={customer.channel}
        />
      </div>

      {/* Favorite Services */}
      {metrics.favorite_services && metrics.favorite_services.length > 0 && (
        <div className="mt-6 pt-6 border-t border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
            Favorite Services
          </h3>
          <div className="space-y-2">
            {metrics.favorite_services.map((fav, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
              >
                <span className="text-neutral-900 font-medium">{fav.service}</span>
                <span className="text-sm text-neutral-500">
                  {fav.count} {fav.count === 1 ? 'visit' : 'visits'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
