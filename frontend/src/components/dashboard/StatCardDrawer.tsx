import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listCustomers } from '../../services/customerApi';
import { fetchAllAppointments } from '../../services/dashboardApi';

export type DrawerType = 'revenue' | 'customers' | 'bookings' | null;

interface StatCardDrawerProps {
  isOpen: boolean;
  type: DrawerType;
  onClose: () => void;
  // Specific data passed from the dashboard sync for revenue
  revenueByService?: { service: string; count: number; revenue: number }[];
  totalRevenue?: number;
  salonId?: string | null;
}

export default function StatCardDrawer({
  isOpen,
  type,
  onClose,
  revenueByService = [],
  totalRevenue = 0,
  salonId,
}: StatCardDrawerProps) {
  const navigate = useNavigate();

  // Lazy load data for customers
  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['drawer', 'customers', salonId],
    queryFn: () => listCustomers(salonId ?? undefined, undefined, 100, 0),
    enabled: isOpen && type === 'customers' && !!salonId,
    staleTime: 60000,
  });

  // Lazy load data for bookings
  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ['drawer', 'bookings', salonId],
    queryFn: () => fetchAllAppointments(salonId!),
    enabled: isOpen && type === 'bookings' && !!salonId,
    staleTime: 60000,
  });

  if (!isOpen) return null;

  const renderContent = () => {
    switch (type) {
      case 'revenue':
        return (
          <div className="flex flex-col h-full">
            <div className="p-6 bg-gradient-to-br from-[var(--color-accent)]/20 to-transparent border-b border-[var(--color-neutral-800)]">
              <p className="text-[var(--color-neutral-400)] text-sm font-medium mb-2">Total Revenue (All Bookings)</p>
              <p className="text-4xl font-bold text-[var(--color-accent)]">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-400)] uppercase tracking-wide mb-4">Revenue by Service</h3>
              {revenueByService.filter((r) => r.revenue > 0).length === 0 ? (
                <div className="text-center py-12 text-[var(--color-neutral-500)]">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No revenue data available yet.</p>
                </div>
              ) : (
                revenueByService
                  .filter((r) => r.revenue > 0)
                  .map((item, index) => (
                    <motion.div
                      key={item.service}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)]"
                    >
                      <div>
                        <p className="text-[var(--color-neutral-100)] font-semibold">{item.service}</p>
                        <p className="text-[var(--color-neutral-500)] text-sm">{item.count} bookings</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[var(--color-neutral-100)] font-bold">₹{item.revenue.toLocaleString('en-IN')}</p>
                        <p className="text-[var(--color-success)] text-xs">{((item.revenue / totalRevenue) * 100).toFixed(1)}%</p>
                      </div>
                    </motion.div>
                  ))
              )}
            </div>
          </div>
        );

      case 'customers':
        return (
          <div className="flex flex-col h-full">
            <div className="p-6 bg-gradient-to-br from-[var(--color-warning)]/20 to-transparent border-b border-[var(--color-neutral-800)] flex justify-between items-end">
              <div>
                <p className="text-[var(--color-warning)] text-sm font-medium mb-2">Active Customers</p>
                <p className="text-4xl font-bold text-[var(--color-warning)]">{customersData?.data?.length || 0}</p>
              </div>
              <button 
                onClick={() => { onClose(); navigate('/customers'); }}
                className="text-sm text-[var(--color-warning)] hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingCustomers ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-[var(--color-warning)] animate-spin" /></div>
              ) : (
                customersData?.data?.slice(0, 50).map((customer: any, index: number) => (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/20 flex items-center justify-center text-[var(--color-warning)] font-bold">
                      {customer.display_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-[var(--color-neutral-100)] font-semibold">{customer.display_name || 'Unknown'}</p>
                      <p className="text-[var(--color-neutral-500)] text-sm capitalize">{customer.channel}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );

      case 'bookings':
        return (
          <div className="flex flex-col h-full">
            <div className="p-6 bg-gradient-to-br from-[var(--color-accent)]/20 to-transparent border-b border-[var(--color-neutral-800)] flex justify-between items-end">
              <div>
                <p className="text-[var(--color-accent)] text-sm font-medium mb-2">Total Bookings</p>
                <p className="text-4xl font-bold text-[var(--color-accent)]">{bookingsData?.length || 0}</p>
              </div>
              <button 
                onClick={() => { onClose(); navigate('/owner/appointments'); }}
                className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
              >
                Manage All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingBookings ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" /></div>
              ) : (
                bookingsData?.slice(0, 50).map((apt: any, index: number) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-base)] border border-[var(--color-neutral-800)]"
                  >
                    <div>
                      <p className="text-[var(--color-neutral-100)] font-semibold">{apt.customer_name}</p>
                      <p className="text-[var(--color-neutral-500)] text-sm">{apt.service_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--color-neutral-300)] text-sm">
                        {new Date(apt.appointment_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className={`text-xs font-semibold capitalize ${
                        apt.status === 'completed' ? 'text-[var(--color-info)]' :
                        apt.status === 'confirmed' ? 'text-[var(--color-success)]' :
                        'text-[var(--color-warning)]'
                      }`}>
                        {apt.status}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'revenue': return 'Revenue Deep Dive';
      case 'customers': return 'Active Customers';
      case 'bookings': return 'Total Bookings';
      default: return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--color-surface-raised)] border-l border-[var(--color-neutral-800)] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-neutral-800)]">
              <h2 className="text-xl font-bold text-[var(--color-neutral-100)]">{getTitle()}</h2>
              <button
                onClick={onClose}
                className="p-2 bg-[var(--color-surface-overlay)] text-[var(--color-neutral-400)] rounded-xl hover:text-[var(--color-neutral-100)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {renderContent()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
