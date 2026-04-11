/*
 * SALON SELECTION PAGE
 * 
 * Displayed after admin login to select which salon dashboard to access.
 * Admins with global access see all salons; salon owners/reception see only their assigned salon.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store, ArrowRight, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

interface Salon {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  is_active: boolean;
  services_count: number;
}

const fetchSalons = async (): Promise<Salon[]> => {
  try {
    console.log('Fetching salons...');
    const { data } = await apiClient.get('/api/v1/salons');
    console.log('Salons response:', data);
    return data.data || [];
  } catch (error: any) {
    console.error('Failed to fetch salons:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    throw error;
  }
};

const SalonSelection = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedSalon, setSelectedSalon] = useState<string | null>(null);

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
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-neutral-400)] hover:text-rose-400 hover:bg-[var(--color-neutral-800)] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
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
    </div>
  );
};

export default SalonSelection;
