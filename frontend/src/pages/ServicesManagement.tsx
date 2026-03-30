import { useState, useMemo } from 'react';
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
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDashboardStats } from '../hooks/useDashboardData';
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
  useAuth();
  const { data: dashboardStats } = useDashboardStats();
  const { services, loading, refetch } = useServices((dashboardStats as any)?.salon_id || '');

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

  // Filter services
  const filteredServices = useMemo(() => {
    let result = services || [];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (svc: any) =>
          svc.name?.toLowerCase().includes(term) ||
          svc.code?.toLowerCase().includes(term) ||
          svc.description?.toLowerCase().includes(term)
      );
    }

    // Active filter
    if (filterActive === 'active') {
      result = result.filter((svc: any) => svc.is_active);
    } else if (filterActive === 'inactive') {
      result = result.filter((svc: any) => !svc.is_active);
    }

    return result;
  }, [services, searchTerm, filterActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        // Update service
        await (window as any).updateService?.(editingId, formData);
      } else {
        // Create service
        await (window as any).createService?.(formData);
      }
      
      // Reset form
      setFormData({
        name: '',
        code: '',
        description: '',
        duration_minutes: 60,
        price: 0,
        is_active: true,
      });
      setEditingId(null);
      setShowForm(false);
      await refetch();
    } catch (err) {
      console.error('Failed to save service:', err);
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
    setShowForm(true);
  };

  const handleToggleActive = async (serviceId: string, currentStatus: boolean) => {
    try {
      await (window as any).updateService?.(serviceId, { is_active: !currentStatus });
      await refetch();
    } catch (err) {
      console.error('Failed to toggle service:', err);
    }
  };

  const handleDeleteService = async (_serviceId: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      try {
        // TODO: Implement delete in backend
        console.warn('Delete service not yet implemented');
        await refetch();
      } catch (err) {
        console.error('Failed to delete service:', err);
      }
    }
  };

  if (loading) {
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-neutral-900">Services Management</h1>
            </div>
            <button
              onClick={() => {
                setFormData({
                  name: '',
                  code: '',
                  description: '',
                  duration_minutes: 60,
                  price: 0,
                  is_active: true,
                });
                setEditingId(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Add Service
            </button>
          </div>
          <p className="text-neutral-600">
            Create and manage salon services, pricing, and duration
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
                placeholder="Search services by name, code, or description..."
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              {['all', 'active', 'inactive'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setFilterActive(filter as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filterActive === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-4 text-sm text-neutral-600">
          Showing <span className="font-semibold">{filteredServices.length}</span> of{' '}
          <span className="font-semibold">{services?.length || 0}</span> services
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-neutral-900">
                  {editingId ? 'Edit Service' : 'Add New Service'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 hover:bg-neutral-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Hair Cutting"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Service Code
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, code: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., HC-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    placeholder="Describe the service..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Duration (mins)
                    </label>
                    <input
                      type="number"
                      required
                      min="5"
                      max="480"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          duration_minutes: parseInt(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          price: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-neutral-700">
                    Active service
                  </label>
                </div>

                <div className="flex gap-2 pt-4 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingId ? 'Update' : 'Create'} Service
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Services Grid */}
        {filteredServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((service: any) => (
              <div
                key={service.id}
                className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-neutral-900">{service.name}</h3>
                    <p className="text-sm text-neutral-500 font-mono">{service.code}</p>
                  </div>
                  <button
                    onClick={() =>
                      handleToggleActive(service.id, service.is_active)
                    }
                    className={`p-2 rounded-lg transition ${
                      service.is_active
                        ? 'bg-green-100 text-green-600'
                        : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {service.is_active ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>

                <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                  {service.description || 'No description'}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-neutral-200">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Duration</p>
                    <p className="text-lg font-semibold text-neutral-900">
                      {service.duration_minutes}
                      <span className="text-sm text-neutral-600 font-normal"> min</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Price</p>
                    <p className="text-lg font-semibold text-neutral-900">
                      ${service.price?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition flex items-center justify-center gap-1 text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center justify-center gap-1 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">No services found</h3>
            <p className="text-neutral-600">
              {searchTerm
                ? 'Try adjusting your search filters'
                : 'Create your first service to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
