import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader,
  AlertCircle,
  Clock,
  DollarSign,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useServices } from '../hooks/useServices';

interface ServiceFormData {
  name: string;
  code: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

export default function ServicesManagement() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Resolve salon id: admin has it in localStorage, owner has it on their user object
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id || '';

  const { services, loading, error, refetch, updateService, deleteService } = useServices(salonId);

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    code: '',
    description: '',
    duration_minutes: 60,
    price: 0,
    is_active: true,
  });
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    let result = services || [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (svc) =>
          svc.name?.toLowerCase().includes(term) ||
          svc.code?.toLowerCase().includes(term) ||
          svc.description?.toLowerCase().includes(term)
      );
    }
    if (filterActive === 'active') result = result.filter((svc) => svc.is_active);
    else if (filterActive === 'inactive') result = result.filter((svc) => !svc.is_active);
    return result;
  }, [services, searchTerm, filterActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (editingId) {
        await updateService(editingId, {
          name: formData.name,
          description: formData.description,
          duration_minutes: formData.duration_minutes,
          price: formData.price,
          is_active: formData.is_active,
        });
      }
      setFormData({ name: '', code: '', description: '', duration_minutes: 60, price: 0, is_active: true });
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to save service.');
    }
  };

  const handleEdit = (service: any) => {
    setFormData({
      name: service.name,
      code: service.code,
      description: service.description || '',
      duration_minutes: service.duration_minutes || 60,
      price: service.price || 0,
      is_active: service.is_active,
    });
    setEditingId(service.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleToggleActive = async (serviceId: string, currentStatus: boolean) => {
    try {
      await updateService(serviceId, { is_active: !currentStatus });
    } catch (err) {
      console.error('Failed to toggle service:', err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (confirm('Are you sure you want to delete this service? This cannot be undone.')) {
      try {
        await deleteService(serviceId);
      } catch (err) {
        console.error('Failed to delete service:', err);
      }
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-neutral-500 text-sm font-medium">Loading services...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-10 max-w-md w-full text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-neutral-900 mb-2">Failed to load services</h3>
          <p className="text-sm text-red-600 mb-6 font-mono break-all">{error}</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Settings className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Services Management</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                {services.length} service{services.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/owner/services/new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
            Add Service
          </button>
        </div>

        {/* Search + filters */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name, code, or description…"
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterActive(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filterActive === f
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm text-neutral-500 mb-4 px-1">
          Showing <span className="font-semibold text-neutral-800">{filteredServices.length}</span> of{' '}
          <span className="font-semibold text-neutral-800">{services.length}</span> services
        </p>

        {/* Edit modal (only for edits — creates go to /owner/services/new) */}
        {showForm && editingId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-neutral-900">Edit Service</h2>
                <button
                  onClick={() => { setShowForm(false); setFormError(null); }}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Service Name <span className="text-red-500">*</span></label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Hair Cutting"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3} placeholder="Describe the service…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Duration (mins) <span className="text-red-500">*</span></label>
                    <input
                      type="number" required min={5} max={480}
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Price (₹) <span className="text-red-500">*</span></label>
                    <input
                      type="number" required min={0} step={0.01}
                      value={formData.price}
                      onChange={(e) => setFormData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox" checked={formData.is_active}
                    onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm font-medium text-neutral-700">Active service</span>
                </label>

                <div className="flex gap-3 pt-4 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError(null); }}
                    className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Services grid */}
        {filteredServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-neutral-900 truncate">{service.name}</h3>
                    <p className="text-xs font-mono text-neutral-400 mt-0.5">{service.code}</p>
                  </div>
                  <button
                    onClick={() => handleToggleActive(service.id, service.is_active)}
                    title={service.is_active ? 'Deactivate' : 'Activate'}
                    className={`ml-3 p-1.5 rounded-lg transition ${
                      service.is_active
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {service.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </div>

                <p className="text-sm text-neutral-500 mb-5 line-clamp-2 min-h-[40px] leading-relaxed">
                  {service.description || 'No description provided'}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-5 pt-4 border-t border-neutral-100">
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      <Clock className="w-3 h-3" /> Duration
                    </p>
                    <p className="text-base font-bold text-neutral-900">
                      {service.duration_minutes}
                      <span className="text-xs font-normal text-neutral-500 ml-1">min</span>
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      <DollarSign className="w-3 h-3" /> Price
                    </p>
                    <p className="text-base font-bold text-blue-600 font-mono">
                      ₹{(service.price ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="flex items-center justify-center px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                    title="Delete service"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200 p-14 text-center shadow-sm">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">No services found</h3>
            <p className="text-neutral-500 text-sm max-w-xs mx-auto mb-6">
              {searchTerm || filterActive !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Add your first service to start accepting bookings.'}
            </p>
            {!searchTerm && filterActive === 'all' && (
              <button
                onClick={() => navigate('/owner/services/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add First Service
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
