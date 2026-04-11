import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, Suspense, lazy } from 'react';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoginRedesigned from './pages/LoginRedesigned';
import DashboardRedesigned from './pages/DashboardRedesigned';
import SalonSelection from './pages/SalonSelection';

// Lazy-loaded routes — code split by page
const AppointmentsList = lazy(() => import('./pages/AppointmentsList'));
const ServicesManagement = lazy(() => import('./pages/ServicesManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ReceptionDashboard = lazy(() => import('./pages/ReceptionDashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));

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
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = createQueryClient();
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientRef.current}>
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
                    <DashboardRedesigned />
                  </ProtectedRoute>
                }
              />

              {/* TIER 1: Critical Features */}
              <Route
                path="/owner/appointments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner', 'reception']}>
                    <AppointmentsList />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/owner/services"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <ServicesManagement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />

              {/* TIER 2: Admin & Reception Dashboards */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reception/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['reception']}>
                    <ReceptionDashboard />
                  </ProtectedRoute>
                }
              />

              {/* TIER 3: Customer Details */}
              <Route
                path="/customers/:customerId"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner', 'reception']}>
                    <CustomerDetail />
                  </ProtectedRoute>
                }
              />

              {/* TIER 4: Analytics & Reports */}
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <Analytics />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'salon_owner']}>
                    <Reports />
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
