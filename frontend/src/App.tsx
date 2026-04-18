import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, Suspense, lazy } from 'react';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLayout from './components/common/AppLayout';
import LoginRedesigned from './pages/LoginRedesigned';
import DashboardRedesigned from './pages/DashboardRedesigned';
import SalonSelection from './pages/SalonSelection';

// Lazy-loaded routes — code split by page
const AppointmentsList = lazy(() => import('./pages/AppointmentsList'));
const ServicesManagement = lazy(() => import('./pages/ServicesManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SalonOwnerDashboard = lazy(() => import('./pages/SalonOwnerDashboard'));
const ReceptionDashboard = lazy(() => import('./pages/ReceptionDashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
const AddServicePage = lazy(() => import('./pages/AddServicePage'));

// Shared loading fallback for lazy routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-base)]">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-[var(--color-neutral-400)] text-sm">Loading page...</p>
    </div>
  </div>
);

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Salon Selection for Admins */}
              <Route
                path="/salon-select"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SalonSelection />
                  </ProtectedRoute>
                }
              />

              {/* Modern Auth View (Pure Tailwind + Custom UI) */}
              <Route path="/login" element={<LoginRedesigned />} />

              {/* Redesigned Dashboard with Real Supabase Data */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner', 'reception']}>
                    <AppLayout><DashboardRedesigned /></AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* TIER 1: Critical Features */}
              <Route
                path="/owner/appointments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner', 'reception']}>
                    <AppLayout><AppointmentsList /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/owner/services"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <AppLayout><ServicesManagement /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/owner/services/new"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <AppLayout><AddServicePage /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout><UserManagement /></AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* TIER 2: Admin & Owner & Reception Dashboards */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout><AdminDashboard /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/owner/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['salon_owner']}>
                    <AppLayout><SalonOwnerDashboard /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reception/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['reception']}>
                    <AppLayout><ReceptionDashboard /></AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* TIER 3: Customer List & Details */}
              <Route
                path="/customers"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner', 'reception']}>
                    <AppLayout><CustomersPage /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/customers/:customerId"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner', 'reception']}>
                    <AppLayout><CustomerDetail /></AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* TIER 4: Analytics & Reports */}
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <AppLayout><Analytics /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <AppLayout><Reports /></AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
