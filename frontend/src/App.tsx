import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef } from 'react';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoginRedesigned from './pages/LoginRedesigned';
import DashboardRedesigned from './pages/DashboardRedesigned';
import AppointmentsList from './pages/AppointmentsList';
import ServicesManagement from './pages/ServicesManagement';
import UserManagement from './pages/UserManagement';
import CustomerDetail from './pages/CustomerDetail';
import AdminDashboard from './pages/AdminDashboard';
import ReceptionDashboard from './pages/ReceptionDashboard';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

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
            <Routes>
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

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
