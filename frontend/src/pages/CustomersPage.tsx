import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, Loader, AlertCircle, MessageCircle, Phone } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { listCustomers } from '../services/customerApi';
import CustomerDrawer from '../components/customers/CustomerDrawer';

type SortField = 'display_name' | 'channel' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function CustomersPage() {
  const { user } = useAuthStore();
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id;

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', 'list', salonId, search],
    queryFn: () => listCustomers(salonId ?? undefined, search || undefined, 200, 0),
    staleTime: 30000,
    retry: 2,
  });

  const customers = data?.data ?? [];

  const filtered = useMemo(() => {
    let result = [...customers];

    if (channelFilter) {
      result = result.filter((c) => c.channel === channelFilter);
    }

    result.sort((a, b) => {
      let aVal: string, bVal: string;
      if (sortField === 'display_name') {
        aVal = a.display_name?.toLowerCase() ?? '';
        bVal = b.display_name?.toLowerCase() ?? '';
      } else if (sortField === 'channel') {
        aVal = a.channel;
        bVal = b.channel;
      } else {
        aVal = a.created_at ?? '';
        bVal = b.created_at ?? '';
      }
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [customers, channelFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const uniqueChannels = [...new Set(customers.map((c) => c.channel))];

  const formatDate = (dateStr: string | null) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        })
      : '—';

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Hero Section */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-[var(--color-accent)]/10 rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
            <Users className="w-7 h-7 text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-neutral-100)]">Customers</h1>
            <p className="text-[var(--color-neutral-400)]">All customers across connected channels</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-[var(--color-surface-raised)] rounded-2xl shadow-xl shadow-black/20 border border-[var(--color-neutral-800)] p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-neutral-500)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full pl-12 pr-4 py-3 bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)] rounded-xl text-[var(--color-neutral-100)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 transition-all placeholder:text-[var(--color-neutral-500)]"
              />
            </div>

            {/* Channel filter pills */}
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => setChannelFilter(null)}
                className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  channelFilter === null
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                    : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-100)] hover:bg-[var(--color-surface-overlay)] border border-transparent'
                }`}
              >
                All
              </button>
              {uniqueChannels.map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch === channelFilter ? null : ch)}
                  className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                    channelFilter === ch
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                      : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-100)] hover:bg-[var(--color-surface-overlay)] border border-transparent'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count */}
        <div className="mb-4 text-sm text-[var(--color-neutral-500)] font-medium">
          Showing <span className="text-[var(--color-neutral-100)]">{filtered.length}</span> of{' '}
          <span className="text-[var(--color-neutral-100)]">{customers.length}</span> customers
        </div>

        {/* Table / List Container */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-[var(--color-surface-raised)] rounded-2xl border border-[var(--color-neutral-800)]">
            <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[var(--color-neutral-400)] text-sm">Fetching customers...</p>
          </div>
        ) : error ? (
          <div className="bg-[var(--color-surface-raised)] rounded-2xl border border-[var(--color-neutral-800)] p-12 text-center">
            <div className="w-16 h-16 bg-[var(--color-danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
            </div>
            <p className="text-[var(--color-neutral-100)] font-bold text-lg mb-2">Failed to load customers</p>
            <p className="text-[var(--color-neutral-400)] mb-6">There was a problem reaching the server.</p>
            <button
              onClick={() => refetch()}
              className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-surface-base)] font-bold rounded-xl hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--color-surface-raised)] rounded-2xl border border-[var(--color-neutral-800)] p-16 text-center shadow-xl">
            <div className="w-20 h-20 bg-[var(--color-surface-overlay)] rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
              <Users className="w-10 h-10 text-[var(--color-neutral-500)]" />
            </div>
            <p className="text-[var(--color-neutral-100)] font-bold text-xl">No customers found</p>
            <p className="text-[var(--color-neutral-500)] mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="bg-[var(--color-surface-raised)] rounded-2xl shadow-2xl shadow-black/40 border border-[var(--color-neutral-800)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-surface-overlay)] border-b border-[var(--color-neutral-800)]">
                    <th
                      className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--color-neutral-100)] transition-colors"
                      onClick={() => toggleSort('display_name')}
                    >
                      Name {sortField === 'display_name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                      Phone & Contact
                    </th>
                    <th
                      className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--color-neutral-100)] transition-colors"
                      onClick={() => toggleSort('channel')}
                    >
                      Channel {sortField === 'channel' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      className="px-6 py-5 text-left text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--color-neutral-100)] transition-colors"
                      onClick={() => toggleSort('created_at')}
                    >
                      Joined {sortField === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-neutral-800)]">
                  {filtered.map((customer) => (
                    <tr
                      key={customer.id}
                      className="group hover:bg-[var(--color-surface-overlay)] transition-all cursor-pointer"
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-accent)]/10 ring-2 ring-[var(--color-surface-base)]">
                            <span className="text-sm font-black text-[var(--color-surface-base)]">
                              {(customer.display_name ?? '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-[var(--color-neutral-100)] group-hover:text-[var(--color-accent)] transition-colors">
                            {customer.display_name || <span className="text-[var(--color-neutral-500)] italic">Unnamed</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {customer.phone_number ? (
                          <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-300)]">
                            <div className="w-7 h-7 bg-[var(--color-surface-base)] rounded-lg flex items-center justify-center">
                              <Phone className="w-3.5 h-3.5 text-[var(--color-neutral-500)]" />
                            </div>
                            {customer.phone_number}
                          </div>
                        ) : (
                          <span className="text-[var(--color-neutral-500)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold capitalize bg-[var(--color-surface-base)] text-[var(--color-neutral-300)] border border-[var(--color-neutral-800)] group-hover:border-[var(--color-accent)]/30 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                          {customer.channel}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-[var(--color-neutral-400)] font-medium">
                        {formatDate(customer.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <CustomerDrawer
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
}
