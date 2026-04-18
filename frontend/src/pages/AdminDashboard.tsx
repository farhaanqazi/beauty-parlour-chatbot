/*
 * ADMIN DASHBOARD
 *
 * System-wide overview for administrators.
 *
 * UI/UX Pro Max Rules Applied:
 * - Priority 1: Accessibility (WCAG AA+, focus states, keyboard nav)
 * - Priority 2: Data Clarity (Clear, concise information)
 * - Priority 5: Role-Based Access (Secure and appropriate views)
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    Building,
    Users,
    Calendar,
    Clock,
    AlertCircle,
    ShieldCheck,

    Plus,
    X,
    CheckCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminDashboardStats } from '../hooks/useDashboardData';
import apiClient from '../services/apiClient';

// ============================================================================
// Constants
// ============================================================================

const TIMEZONES = [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Bangkok',
    'Asia/Karachi',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Australia/Sydney',
    'Pacific/Auckland',
    'UTC',
];

const LANGUAGES = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'arabic', label: 'Arabic' },
    { value: 'french', label: 'French' },
    { value: 'spanish', label: 'Spanish' },
];

// ============================================================================
// Helpers
// ============================================================================

const toSlug = (name: string) =>
    name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

// ============================================================================
// Loading Skeletons
// ============================================================================

const StatCardSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-neutral-200 rounded-xl" />
    </div>
    <div className="space-y-2">
      <div className="w-24 h-8 bg-neutral-200 rounded" />
      <div className="w-32 h-4 bg-neutral-200 rounded" />
    </div>
  </div>
);

// ============================================================================
// Error & Access States
// ============================================================================

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <AlertCircle className="w-16 h-16 text-rose-500 mb-4" strokeWidth={1.5} />
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Failed to load data</h3>
    <p className="text-neutral-500 mb-4 max-w-md">{message}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
    >
      Try Again
    </button>
  </div>
);

const UnauthorizedAccess = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <ShieldCheck className="w-16 h-16 text-red-500 mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">Access Denied</h3>
      <p className="text-neutral-500 mb-4 max-w-md">You do not have the required permissions to view this page.</p>
    </div>
  );

// ============================================================================
// Stat Card
// ============================================================================

const StatCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
        <Icon className="w-6 h-6 text-white" strokeWidth={2} aria-hidden="true" />
      </div>
    </div>
    <div className="space-y-1">
      <p className="text-3xl font-bold text-neutral-900" style={{ fontFamily: 'Fira Code, monospace' }}>
        {value}
      </p>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  </div>
);

// ============================================================================
// Create Salon Modal
// ============================================================================

interface CreateSalonModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateSalonModal = ({ onClose, onCreated }: CreateSalonModalProps) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [language, setLanguage] = useState('english');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-generate slug from name unless user has manually edited it
  useEffect(() => {
    if (!slugTouched) {
      setSlug(toSlug(name));
    }
  }, [name, slugTouched]);

  const slugValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length === 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/api/v1/salons', {
        name: name.trim(),
        slug: slug.trim(),
        timezone,
        default_language: language,
      });
      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to create salon. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-salon-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <Building className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <h2 id="create-salon-title" className="text-lg font-bold text-neutral-900">
              New Salon
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-neutral-500" strokeWidth={2} />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
            <CheckCircle className="w-14 h-14 text-emerald-500" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-neutral-900">Salon created!</p>
            <p className="text-sm text-neutral-500">Redirecting…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Salon Name */}
            <div>
              <label htmlFor="salon-name" className="block text-sm font-medium text-neutral-700 mb-1">
                Salon Name <span className="text-red-500">*</span>
              </label>
              <input
                id="salon-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Glow & Go Beauty"
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="salon-slug" className="block text-sm font-medium text-neutral-700 mb-1">
                URL Slug <span className="text-red-500">*</span>
              </label>
              <input
                id="salon-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setSlugTouched(true);
                }}
                placeholder="glow-and-go-beauty"
                required
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent font-mono ${
                  slug && !slugValid ? 'border-red-400 bg-red-50' : 'border-neutral-300'
                }`}
              />
              {slug && !slugValid && (
                <p className="mt-1 text-xs text-red-500">Only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.</p>
              )}
              <p className="mt-1 text-xs text-neutral-400">Used in API routes — must be unique across all salons.</p>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="salon-timezone" className="block text-sm font-medium text-neutral-700 mb-1">
                Timezone
              </label>
              <select
                id="salon-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label htmlFor="salon-language" className="block text-sm font-medium text-neutral-700 mb-1">
                Default Language
              </label>
              <select
                id="salon-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" strokeWidth={2} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !slug.trim() || !slugValid}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {submitting ? 'Creating…' : 'Create Salon'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Admin Dashboard Component
// ============================================================================

const AdminDashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useAdminDashboardStats();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleSalonCreated = () => {
    // Refresh stats (total salons count) and the salon list used by SalonSelection
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['salons', 'list'] });
  };

  if (authLoading) {
    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      );
  }

  if (!isAdmin) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
            <UnauthorizedAccess />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-50">
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Page Hero Section - Unified with Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-pink-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Admin Dashboard</h1>
              <p className="text-sm text-neutral-500">System-wide monitoring and oversight</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            <span>New Salon</span>
          </button>
        </div>
        {statsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
            </div>
        )}
        {statsError && (
            <ErrorState
                message="Failed to load system analytics. Please check the API connection."
                onRetry={() => refetchStats()}
            />
        )}
        {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                label="Total Salons"
                value={stats.total_salons}
                icon={Building}
            />
            <StatCard
                label="Total Users"
                value={stats.total_users}
                icon={Users}
            />
            <StatCard
                label="Today's Appointments"
                value={stats.todays_appointments}
                icon={Calendar}
            />
            <StatCard
                label="Pending Appointments"
                value={stats.pending_appointments}
                icon={Clock}
            />
            </div>
        )}
      </main>

      {showCreateModal && (
        <CreateSalonModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleSalonCreated}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
