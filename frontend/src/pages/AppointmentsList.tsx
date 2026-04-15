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
import { useDashboardStats, useTodayAppointments } from '../hooks/useDashboardData';
import { useAuth } from '../hooks/useAuth';

interface Appointment {
  id: string;
  booking_reference: string;
  service: string;
  customer: string;
  customer_id?: string;
  appointment_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  final_price?: number;
}

interface FilterState {
  searchTerm: string;
  status: string | null;
  dateRange: 'today' | '7days' | '30days' | 'all';
}

export default function AppointmentsList() {
  const navigate = useNavigate();
  const { isLoading: authLoading } = useAuth();
  const { isLoading: statsLoading } = useDashboardStats();
  const { data: appointments = [], isLoading: appointmentsLoading } = useTodayAppointments() as any;
  
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    status: null,
    dateRange: '7days',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'status'>('date');

  // Filter and sort appointments
  const filteredAppointments = useMemo(() => {
    let result = appointments;

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(
        (apt: Appointment) =>
          apt.customer?.toLowerCase().includes(term) ||
          apt.service?.toLowerCase().includes(term) ||
          apt.booking_reference?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filters.status) {
      result = result.filter((apt: Appointment) => apt.status === filters.status);
    }

    // Sort
    if (sortBy === 'customer') {
      result.sort((a: Appointment, b: Appointment) => (a.customer || '').localeCompare(b.customer || ''));
    } else if (sortBy === 'status') {
      result.sort((a: Appointment, b: Appointment) => a.status.localeCompare(b.status));
    } else {
      result.sort(
        (a: Appointment, b: Appointment) =>
          new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
      );
    }

    return result;
  }, [appointments, filters, sortBy]);

  const getStatusBadge = (status: string) => {
    const styles = {
      confirmed: 'bg-green-100 text-green-800 border border-green-300',
      pending: 'bg-amber-100 text-amber-800 border border-amber-300',
      completed: 'bg-blue-100 text-blue-800 border border-blue-300',
      cancelled: 'bg-red-100 text-red-800 border border-red-300',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
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

  const isLoading = authLoading || statsLoading || appointmentsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-neutral-900">Appointments</h1>
          </div>
          <p className="text-neutral-600">
            Manage all salon appointments and bookings
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 mb-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by customer name, service, or booking reference..."
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters(prev => ({ ...prev, searchTerm: e.target.value }))
                }
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {/* Status Quick Filter */}
              <div className="flex gap-2">
                {['pending', 'confirmed', 'completed', 'cancelled'].map(status => (
                  <button
                    key={status}
                    onClick={() =>
                      setFilters(prev => ({
                        ...prev,
                        status: prev.status === status ? null : status,
                      }))
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      filters.status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="border-t border-neutral-200 pt-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Date Range
                </label>
                <div className="flex gap-2">
                  {['today', '7days', '30days', 'all'].map(range => (
                    <button
                      key={range}
                      onClick={() =>
                        setFilters(prev => ({ ...prev, dateRange: range as any }))
                      }
                      className={`px-3 py-2 rounded-lg text-sm transition ${
                        filters.dateRange === range
                          ? 'bg-amber-100 text-amber-900 border-2 border-amber-300'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {range === 'today' && 'Today'}
                      {range === '7days' && 'Next 7 Days'}
                      {range === '30days' && 'Next 30 Days'}
                      {range === 'all' && 'All'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="customer">Customer Name</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-4 text-sm text-neutral-600">
          Showing <span className="font-semibold">{filteredAppointments.length}</span> of{' '}
          <span className="font-semibold">{appointments.length}</span> appointments
        </div>

        {/* Appointments Table */}
        {filteredAppointments.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Booking Reference
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Service
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-neutral-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredAppointments.map((apt: Appointment, idx: number) => (
                    <tr
                      key={apt.id || idx}
                      className="hover:bg-neutral-50 transition"
                    >
                      <td className="px-6 py-4 text-sm text-neutral-900 font-mono">
                        {apt.booking_reference}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900">
                        {apt.customer || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900">
                        {apt.service || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900">
                        {formatTime(apt.appointment_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 font-medium">
                        {apt.final_price ? `₹${apt.final_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getStatusBadge(
                            apt.status
                          )}`}
                        >
                          {getStatusIcon(apt.status)}
                          <span className="text-xs font-semibold">
                            {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => apt.customer_id && navigate(`/customers/${apt.customer_id}`)}
                            disabled={!apt.customer_id}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            View
                          </button>
                          {apt.status === 'pending' && (
                            <button className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-xs font-medium transition">
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">No appointments found</h3>
            <p className="text-neutral-600">
              Try adjusting your search filters or date range
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
