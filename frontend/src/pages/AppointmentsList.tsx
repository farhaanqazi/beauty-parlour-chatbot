import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  Loader,
  AlertCircle,
} from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';
import AppointmentDrawer from '../components/appointments/AppointmentDrawer';
import type { Appointment, AppointmentStatus } from '../types/index';

interface FilterState {
  searchTerm: string;
  status: AppointmentStatus | null;
  dateRange: 'today' | '7days' | '30days' | 'all';
}

export default function AppointmentsList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;
  
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    status: null,
    dateRange: '7days',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'status'>('date');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Debounce search to avoid spamming the DB
  const debouncedSearch = useDebounce(filters.searchTerm, 500);

  // Map UI range to ISO date boundaries for the API
  const dateParams = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    
    if (filters.dateRange === 'today') {
      const endOfToday = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      return { from: startOfToday, to: endOfToday };
    }
    if (filters.dateRange === '7days') {
      const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      return { from: startOfToday, to: next7Days };
    }
    if (filters.dateRange === '30days') {
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return { from: startOfToday, to: next30Days };
    }
    return { from: undefined, to: undefined };
  }, [filters.dateRange]);

  // Reactive DB Query - Use isFetching to track sub-queries
  const { data: appointmentData, isLoading, isFetching, error, refetch } = useAppointments({
    salon_id: salonId || undefined,
    status: (filters.status as any) || undefined,
    date_from: dateParams.from,
    date_to: dateParams.to,
    search: debouncedSearch || undefined,
    page: 1,
    page_size: 100
  });

  const appointments = appointmentData?.data || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
      case 'cancelled_by_salon':
      case 'cancelled_closure':
        return <X className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show loading state if it's the first load OR if we're refetching (e.g. searching)
  const isPending = isLoading || isFetching;

  if (isPending && appointments.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-base)] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-neutral-400)] font-bold animate-pulse">Querying Database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-base)] flex items-center justify-center p-6">
        <div className="bg-[var(--color-surface-raised)] rounded-2xl border border-[var(--color-neutral-800)] p-12 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-neutral-100)] mb-2">DB Connection Failed</h2>
          <p className="text-[var(--color-neutral-400)] mb-8">We couldn't reach the database to fetch appointments.</p>
          <button
            onClick={() => refetch()}
            className="w-full py-4 bg-[var(--color-accent)] text-[var(--color-surface-base)] font-black rounded-xl hover:bg-[var(--color-accent-hover)] transition-all"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--color-accent)]/10 rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
              <Calendar className="w-7 h-7 text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-neutral-100)]">Appointments</h1>
              <p className="text-sm text-[var(--color-neutral-400)]">Manage and oversee all salon bookings</p>
            </div>
          </div>
        </div>

        {/* Search and Filters Container */}
        <div className="bg-[var(--color-surface-raised)] rounded-2xl shadow-xl shadow-black/20 border border-[var(--color-neutral-800)] p-5 mb-6">
          <div className="flex flex-col gap-5">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-neutral-500)]" />
              <input
                type="text"
                placeholder="Search by customer name, service, or booking reference..."
                className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)] rounded-xl text-[var(--color-neutral-100)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 transition-all placeholder:text-[var(--color-neutral-500)]"
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters(prev => ({ ...prev, searchTerm: e.target.value }))
                }
              />
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`min-h-[48px] flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
                  showFilters 
                    ? 'bg-[var(--color-accent)] text-[var(--color-surface-base)]' 
                    : 'bg-[var(--color-surface-overlay)] text-[var(--color-neutral-100)] border border-[var(--color-neutral-700)] hover:bg-[var(--color-surface-floating)]'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              <div className="h-8 w-px bg-[var(--color-neutral-800)] mx-2 hidden sm:block" />

              {/* Status Quick Filter Pills */}
              <div className="flex gap-2 flex-wrap">
                {['pending', 'confirmed', 'completed', 'cancelled'].map(status => (
                  <button
                    key={status}
                    onClick={() =>
                      setFilters(prev => ({
                        ...prev,
                        status: prev.status === status ? null : status,
                      }))
                    }
                    className={`min-h-[48px] px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                      filters.status === status
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                        : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-100)] hover:bg-[var(--color-surface-overlay)]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Filters Drawer */}
            {showFilters && (
              <div className="border-t border-[var(--color-neutral-800)] pt-5 animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-neutral-500)] mb-3">
                  Date Range
                </label>
                <div className="flex flex-wrap gap-2">
                  {['today', '7days', '30days', 'all'].map(range => (
                    <button
                      key={range}
                      onClick={() =>
                        setFilters(prev => ({ ...prev, dateRange: range as any }))
                      }
                      className={`min-h-[48px] px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                        filters.dateRange === range
                          ? 'bg-[var(--color-accent)] text-[var(--color-surface-base)] shadow-lg shadow-[var(--color-accent)]/20'
                          : 'bg-[var(--color-surface-base)] text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-100)] border border-[var(--color-neutral-800)]'
                      }`}
                    >
                      {range === 'today' && 'Today'}
                      {range === '7days' && 'Next 7 Days'}
                      {range === '30days' && 'Next 30 Days'}
                      {range === 'all' && 'All Bookings'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort & Info Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3 text-sm text-[var(--color-neutral-400)]">
                <span className="font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)] text-[var(--color-neutral-100)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                >
                  <option value="date">Date & Time</option>
                  <option value="customer">Customer Name</option>
                  <option value="status">Booking Status</option>
                </select>
              </div>

              <div className="text-sm text-[var(--color-neutral-500)]">
                Showing <span className="text-[var(--color-neutral-100)] font-bold">{appointments.length}</span> appointments
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Table Container */}
        {appointments.length > 0 ? (
          <div className="bg-[var(--color-surface-raised)] rounded-2xl shadow-2xl shadow-black/40 border border-[var(--color-neutral-800)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-[var(--color-surface-overlay)] border-b border-[var(--color-neutral-800)]">
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-5 text-center text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-neutral-800)]">
                  {appointments.map((apt: Appointment, idx: number) => (
                    <tr
                      key={apt.id || idx}
                      className="group hover:bg-[var(--color-surface-overlay)] transition-all cursor-pointer"
                      onClick={() => setSelectedAppointment(apt)}
                    >
                      <td className="px-6 py-5 text-sm font-mono text-[var(--color-accent)]">
                        {apt.booking_reference}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-[var(--color-neutral-100)]">
                        {apt.customer || '—'}
                      </td>
                      <td className="px-6 py-5 text-sm text-[var(--color-neutral-300)]">
                        {apt.service || '—'}
                      </td>
                      <td className="px-6 py-5 text-sm text-[var(--color-neutral-400)] font-medium">
                        {formatTime(apt.appointment_at)}
                      </td>
                      <td className="px-6 py-5 text-sm text-[var(--color-neutral-100)] font-bold">
                        {apt.final_price ? `₹${apt.final_price.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-5">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${
                            apt.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            apt.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            apt.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {getStatusIcon(apt.status)}
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {apt.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedAppointment(apt)}
                          className="px-4 py-2 bg-[var(--color-surface-base)] text-[var(--color-neutral-300)] border border-[var(--color-neutral-800)] rounded-lg hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all text-xs font-bold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-surface-raised)] rounded-2xl border border-[var(--color-neutral-800)] p-20 text-center shadow-xl">
            <div className="w-24 h-24 bg-[var(--color-surface-overlay)] rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3">
              <AlertCircle className="w-12 h-12 text-[var(--color-neutral-500)]" />
            </div>
            <p className="text-[var(--color-neutral-100)] font-bold text-xl mb-2">No appointments found</p>
            <p className="text-[var(--color-neutral-500)]">Try adjusting your search filters or date range</p>
          </div>
        )}
      </main>

      <AppointmentDrawer
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
