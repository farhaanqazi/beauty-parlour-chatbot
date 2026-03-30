import { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  X,
  Loader,
  Shield,
  Mail,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../hooks/useUsers';
import { useUsers } from '../hooks/useUsers';

interface UserFormData {
  email: string;
  full_name: string;
  role: 'admin' | 'salon_owner' | 'staff' | 'reception';
  salon_id?: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { users, loading, createUser, updateUser, deleteUser } = useUsers();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    full_name: '',
    role: 'staff',
    salon_id: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter users
  const filteredUsers = useMemo(() => {
    let result = users || [];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u: User) =>
          u.full_name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          u.salon_name?.toLowerCase().includes(term)
      );
    }

    // Role filter
    if (roleFilter) {
      result = result.filter((u: User) => u.role === roleFilter);
    }

    // Sort by name
    result.sort((a: User, b: User) =>
      (a.full_name || '').localeCompare(b.full_name || '')
    );

    return result;
  }, [users, searchTerm, roleFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (editingId) {
        // Update user
        await updateUser(editingId, {
          full_name: formData.full_name,
          is_active: true,
        });
      } else {
        // Create user
        await createUser(formData);
      }

      // Reset form
      setFormData({
        email: '',
        full_name: '',
        role: 'staff',
        salon_id: '',
      });
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (user: User) => {
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      salon_id: user.salon_id || '',
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      await updateUser(userId, { is_active: !currentStatus });
    } catch (err) {
      console.error('Failed to toggle user:', err);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (
      confirm(
        `Are you sure you want to delete ${userName}? This action cannot be undone.`
      )
    ) {
      try {
        await deleteUser(userId);
      } catch (err) {
        console.error('Failed to delete user:', err);
      }
    }
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-800 border border-purple-300',
      salon_owner: 'bg-blue-100 text-blue-800 border border-blue-300',
      staff: 'bg-green-100 text-green-800 border border-green-300',
      reception: 'bg-amber-100 text-amber-800 border border-amber-300',
    };
    return styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-neutral-900">User Management</h1>
            </div>
            <button
              onClick={() => {
                setFormData({
                  email: '',
                  full_name: '',
                  role: 'staff',
                  salon_id: '',
                });
                setEditingId(null);
                setShowForm(true);
                setError(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Add User
            </button>
          </div>
          <p className="text-neutral-600">
            Manage staff, admins, and receptionist accounts
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
                placeholder="Search by name, email, or salon..."
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <div className="flex gap-2">
              {[null, 'admin', 'salon_owner', 'staff', 'reception'].map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    roleFilter === role
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {role ? role.replace('_', ' ').toUpperCase() : 'All Roles'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-4 text-sm text-neutral-600">
          Showing <span className="font-semibold">{filteredUsers.length}</span> of{' '}
          <span className="font-semibold">{users?.length || 0}</span> users
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-neutral-900">
                  {editingId ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  className="p-1 hover:bg-neutral-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingId}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, full_name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Role
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        role: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="staff">Staff</option>
                    <option value="reception">Reception</option>
                    <option value="salon_owner">Salon Owner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {formData.role !== 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Salon ID {formData.role === 'salon_owner' ? '(Required)' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      value={formData.salon_id || ''}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, salon_id: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Salon UUID"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setError(null);
                    }}
                    className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'} User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Table */}
        {filteredUsers.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Salon
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-neutral-900">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-neutral-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredUsers.map((u: User, idx: number) => (
                    <tr key={u.id || idx} className="hover:bg-neutral-50 transition">
                      <td className="px-6 py-4 text-sm text-neutral-900 font-medium">
                        {u.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {getRoleIcon(u.role)}
                          <span className="text-xs font-semibold">
                            {u.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900">
                        {u.salon_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() =>
                            handleToggleActive(u.id, u.is_active)
                          }
                          className={`p-2 rounded-lg transition ${
                            u.is_active
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {u.is_active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(u)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-medium transition flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() =>
                                handleDeleteUser(u.id, u.full_name)
                              }
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs font-medium transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
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
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">No users found</h3>
            <p className="text-neutral-600">
              {searchTerm ? 'Try adjusting your search filters' : 'Create your first user to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
