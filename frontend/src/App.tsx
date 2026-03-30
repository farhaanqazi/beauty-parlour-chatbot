import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef } from 'react';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoginRedesigned from './pages/LoginRedesigned';
import DashboardRedesigned from './pages/DashboardRedesigned';

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
              
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
