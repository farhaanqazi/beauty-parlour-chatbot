/*
 * SALON SELECTION PAGE
 * 
 * Displayed after admin login to select which salon dashboard to access.
 * Admins with global access see all salons; salon owners/reception see only their assigned salon.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, ArrowRight, LogOut, Building2, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';
import { fetchSalons, type Salon } from '../services/dashboardApi';


// ============================================================================
// Create Salon Modal
// ============================================================================

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Bangkok',
  'Asia/Karachi', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
];

const toSlug = (name: string) =>
  name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

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
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [telegramWarning, setTelegramWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(toSlug(name));
  }, [name, slugTouched]);

  const slugValid = slug.length < 2 || /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !slugValid) return;

    setSubmitting(true);
    setError(null);
    setTelegramWarning(null);
    try {
      const res = await apiClient.post('/api/v1/salons', {
        name: name.trim(),
        slug: slug.trim(),
        timezone,
        default_language: language,
        ...(telegramToken.trim() && { telegram_bot_token: telegramToken.trim() }),
        ...(telegramUsername.trim() && { telegram_bot_username: telegramUsername.trim() }),
      });
      const telegramStatus = res.data?.telegram_status;
      if (telegramStatus === 'registering') {
        setTelegramWarning('Salon created! Telegram webhook is being registered in the background. This may take a few seconds.');
      } else if (telegramStatus && telegramStatus !== 'registered') {
        setTelegramWarning(`Salon created, but Telegram webhook failed: ${telegramStatus}. Check the bot token and try again.`);
      }
      setSuccess(true);
      setTimeout(() => { onCreated(); onClose(); }, telegramWarning ? 3000 : 1200);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e: any) => e?.msg ?? JSON.stringify(e)).join(', ')
          : err?.message ?? 'Failed to create salon. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-salon-title"
    >
      <div className="bg-[var(--color-surface-raised)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-neutral-700)]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-neutral-700)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[var(--color-accent)] to-amber-600 rounded-xl">
              <Building2 className="w-5 h-5 text-[var(--color-surface-base)]" strokeWidth={2} />
            </div>
            <h2 id="create-salon-title" className="text-lg font-bold text-[var(--color-neutral-100)]">
              New Salon
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-neutral-700)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-[var(--color-neutral-400)]" strokeWidth={2} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
            <CheckCircle className="w-14 h-14 text-emerald-400" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-[var(--color-neutral-100)]">Salon created!</p>
            {telegramWarning ? (
              <p className="text-sm text-amber-400 text-center px-4">{telegramWarning}</p>
            ) : telegramToken ? (
              <p className="text-sm text-emerald-400">Telegram bot connected & webhook registered.</p>
            ) : (
              <p className="text-sm text-[var(--color-neutral-400)]">Refreshing salon list…</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label htmlFor="cs-name" className="block text-sm font-medium text-[var(--color-neutral-300)] mb-1">
                Salon Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="cs-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Glow & Go Beauty"
                required
                className="w-full px-3 py-2 bg-[var(--color-neutral-800)] border border-[var(--color-neutral-600)] rounded-lg text-sm text-[var(--color-neutral-100)] placeholder-[var(--color-neutral-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="cs-slug" className="block text-sm font-medium text-[var(--color-neutral-300)] mb-1">
                URL Slug <span className="text-rose-400">*</span>
              </label>
              <input
                id="cs-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setSlugTouched(true);
                }}
                placeholder="glow-and-go-beauty"
                required
                className={`w-full px-3 py-2 bg-[var(--color-neutral-800)] border rounded-lg text-sm text-[var(--color-neutral-100)] placeholder-[var(--color-neutral-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent font-mono ${
                  slug && !slugValid ? 'border-rose-500' : 'border-[var(--color-neutral-600)]'
                }`}
              />
              {slug && !slugValid && (
                <p className="mt-1 text-xs text-rose-400">Lowercase letters, numbers, hyphens only. Cannot start or end with a hyphen.</p>
              )}
              <p className="mt-1 text-xs text-[var(--color-neutral-500)]">Unique identifier used in API routes.</p>
            </div>

            <div>
              <label htmlFor="cs-tz" className="block text-sm font-medium text-[var(--color-neutral-300)] mb-1">Timezone</label>
              <select
                id="cs-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-neutral-800)] border border-[var(--color-neutral-600)] rounded-lg text-sm text-[var(--color-neutral-100)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="cs-lang" className="block text-sm font-medium text-[var(--color-neutral-300)] mb-1">Default Language</label>
              <select
                id="cs-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-neutral-800)] border border-[var(--color-neutral-600)] rounded-lg text-sm text-[var(--color-neutral-100)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {/* Telegram Integration */}
            <div className="border border-[var(--color-neutral-700)] rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-neutral-800)]">
                <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 13.447l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.888.112z"/>
                </svg>
                <span className="text-sm font-medium text-[var(--color-neutral-200)]">Telegram Bot</span>
                <span className="ml-auto text-xs text-[var(--color-neutral-500)]">Optional</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <label htmlFor="cs-tg-token" className="block text-xs font-medium text-[var(--color-neutral-400)] mb-1">
                    Bot Token <span className="text-[var(--color-neutral-600)]">(from @BotFather)</span>
                  </label>
                  <input
                    id="cs-tg-token"
                    type="text"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="1234567890:AABBccDDee..."
                    className="w-full px-3 py-2 bg-[var(--color-neutral-800)] border border-[var(--color-neutral-600)] rounded-lg text-xs text-[var(--color-neutral-100)] placeholder-[var(--color-neutral-600)] focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="cs-tg-user" className="block text-xs font-medium text-[var(--color-neutral-400)] mb-1">
                    Bot Username
                  </label>
                  <input
                    id="cs-tg-user"
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="@mysalon_bot"
                    className="w-full px-3 py-2 bg-[var(--color-neutral-800)] border border-[var(--color-neutral-600)] rounded-lg text-xs text-[var(--color-neutral-100)] placeholder-[var(--color-neutral-600)] focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
                <p className="text-xs text-[var(--color-neutral-600)]">
                  The webhook will be registered automatically on creation.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-900/20 border border-rose-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" strokeWidth={2} />
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-700)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !slug.trim() || !slugValid}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-[var(--color-accent)] to-amber-600 hover:from-amber-500 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-surface-base)] rounded-lg transition-all"
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
// Salon Selection Page
// ============================================================================

const SalonSelection = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedSalon, setSelectedSalon] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: salons, isLoading, error, refetch } = useQuery({
    queryKey: ['salons', 'list'],
    queryFn: fetchSalons,
    staleTime: 60000,
    retry: 1,
  });

  // Filter salons based on user role
  const availableSalons = user?.role === 'admin' 
    ? salons || [] 
    : salons?.filter(s => s.id === user?.salon_id) || [];

  // Auto-select if only one salon available
  const handleSelectSalon = (salonId: string) => {
    setSelectedSalon(salonId);
  };

  const handleConfirm = () => {
    if (selectedSalon) {
      // Store selected salon in localStorage for dashboard to use
      localStorage.setItem('selectedSalonId', selectedSalon);
      const salonName = availableSalons.find(s => s.id === selectedSalon)?.name ?? '';
      localStorage.setItem('selectedSalonName', salonName);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--color-surface-raised)] border-b border-[var(--color-neutral-700)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-accent)] to-amber-600 rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-[var(--color-surface-base)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-neutral-100)]">
                {user?.role === 'admin' ? 'Admin Dashboard' : 'Salon Manager'}
              </h1>
              <p className="text-xs text-[var(--color-neutral-400)]">
                {user?.role === 'admin' ? 'Select a salon to manage' : 'Manage your salon'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-[var(--color-accent)] to-amber-600 hover:from-amber-500 hover:to-amber-700 text-[var(--color-surface-base)] rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              New Salon
            </button>
            <button
              onClick={() => {
                console.log('[SalonSelection] Sign Out button clicked');
                logout();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-neutral-400)] hover:text-rose-400 hover:bg-[var(--color-neutral-800)] rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[var(--color-neutral-100)] mb-2">
              Welcome, {user?.full_name || user?.email}
            </h2>
            <p className="text-[var(--color-neutral-400)]">
              {user?.role === 'admin' 
                ? `Choose which salon dashboard you'd like to access.`
                : `You have access to the following salon.`
              }
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[var(--color-surface-raised)] rounded-2xl p-6 border border-[var(--color-neutral-700)] animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[var(--color-neutral-700)] rounded-xl" />
                    <div className="flex-1 space-y-3">
                      <div className="w-32 h-5 bg-[var(--color-neutral-700)] rounded" />
                      <div className="w-24 h-4 bg-[var(--color-neutral-700)] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-rose-900/20 border border-rose-800 rounded-2xl p-8 text-center">
              <Building2 className="w-12 h-12 text-rose-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-rose-300 mb-2">Failed to load salons</h3>
              <p className="text-rose-400/70 mb-4">
                {(error as any)?.response?.data?.detail || 'Please check your connection and try again.'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-rose-100 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : availableSalons.length === 0 ? (
            <div className="bg-[var(--color-neutral-800)] rounded-2xl p-12 text-center">
              <Building2 className="w-16 h-16 text-[var(--color-neutral-600)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-neutral-200)] mb-2">No salons available</h3>
              <p className="text-[var(--color-neutral-400)]">Contact your administrator to get access to a salon.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {availableSalons.map((salon) => (
                  <button
                    key={salon.id}
                    onClick={() => handleSelectSalon(salon.id)}
                    className={`
                      text-left bg-[var(--color-surface-raised)] rounded-2xl p-6 border transition-all
                      ${selectedSalon === salon.id 
                        ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/50 bg-[var(--color-surface-raised)]/95' 
                        : 'border-[var(--color-neutral-700)] hover:border-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-800)]'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center transition-colors
                        ${selectedSalon === salon.id 
                          ? 'bg-gradient-to-br from-[var(--color-accent)] to-amber-600' 
                          : 'bg-[var(--color-neutral-700)]'
                        }
                      `}>
                        <Store className={`w-6 h-6 ${selectedSalon === salon.id ? 'text-[var(--color-surface-base)]' : 'text-[var(--color-neutral-400)]'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold text-lg ${selectedSalon === salon.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-neutral-100)]'}`}>
                          {salon.name}
                        </h3>
                        <p className="text-sm text-[var(--color-neutral-400)] mt-1">
                          {salon.services_count} services · {salon.timezone}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                            ${salon.is_active 
                              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' 
                              : 'bg-rose-900/30 text-rose-400 border border-rose-800'
                            }
                          `}>
                            {salon.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Confirm Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleConfirm}
                  disabled={!selectedSalon}
                  className={`
                    inline-flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all
                    ${selectedSalon
                      ? 'bg-gradient-to-r from-[var(--color-accent)] to-amber-600 hover:from-amber-500 hover:to-amber-700 text-[var(--color-surface-base)] shadow-lg shadow-[var(--color-accent)]/30 cursor-pointer'
                      : 'bg-[var(--color-neutral-700)] text-[var(--color-neutral-500)] cursor-not-allowed'
                    }
                  `}
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {showCreateModal && (
        <CreateSalonModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['salons', 'list'] });
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default SalonSelection;
