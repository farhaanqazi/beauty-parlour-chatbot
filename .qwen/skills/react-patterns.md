# React Patterns Skill - Beauty Parlour Chatbot

**Purpose:** React 19 + TypeScript best practices tailored for the beauty parlour chatbot frontend.

---

## 🎯 When to Use

- Creating new components
- State management decisions
- Data fetching patterns
- Performance optimization
- TypeScript typing

---

## 📋 Core Patterns

### 1. Functional Component Pattern

```tsx
import React from 'react';
import { Box, Typography } from '@mui/material';

interface AppointmentCardProps {
  title: string;
  date: string;
  time: string;
  customerName: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  onStatusChange?: (newStatus: string) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  title,
  date,
  time,
  customerName,
  status,
  onStatusChange,
}) => {
  return (
    <Box 
      sx={{ 
        p: 2, 
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: 1
      }}
    >
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {date} at {time}
      </Typography>
      <Typography variant="body2">
        Customer: {customerName}
      </Typography>
      <Typography 
        variant="caption" 
        sx={{ 
          color: status === 'confirmed' ? 'success.main' : 'warning.main' 
        }}
      >
        {status}
      </Typography>
    </Box>
  );
};
```

**Key Points:**
- Use `React.FC` with interface for props
- Destructure props in parameter list
- Use semantic HTML elements
- Apply MUI sx prop for styling
- Use variant system for typography

---

### 2. Custom Hook Pattern

```tsx
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '../services/api';

interface UseAppointmentsOptions {
  salonId?: number;
  status?: string;
  enabled?: boolean;
}

export const useAppointments = (options: UseAppointmentsOptions = {}) => {
  const queryClient = useQueryClient();
  const { salonId, status, enabled = true } = options;

  // Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['appointments', { salonId, status }],
    queryFn: () => appointmentApi.getAll({ salonId, status }),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: appointmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      appointmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: appointmentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    appointments: data,
    isLoading,
    error,
    refetch,
    createAppointment: createMutation.mutateAsync,
    updateAppointment: updateMutation.mutateAsync,
    deleteAppointment: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
```

**Key Points:**
- Use options object for flexibility
- Return consistent interface
- Handle loading/error states
- Invalidate queries on mutation
- Use `useMutation` for writes

---

### 3. Zustand State Management Pattern

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: async (token: string) => {
        // Fetch user profile
        const user = await authApi.getProfile(token);
        set({ user, token, isAuthenticated: true });
      },
      
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
      
      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// Usage in component
const UserProfile = () => {
  const { user, logout, updateUser } = useAuthStore();
  
  return (
    <Box>
      <Typography>{user?.name}</Typography>
      <Button onClick={logout}>Logout</Button>
    </Box>
  );
};
```

**Key Points:**
- Use `create` for store definition
- Add `persist` middleware for localStorage
- Use `partialize` to control what persists
- Return actions from store
- Use `get()` to access current state in actions

---

### 4. Error Boundary Pattern

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box 
          sx={{ 
            p: 3, 
            textAlign: 'center',
            bgcolor: 'error.light',
            borderRadius: 2
          }}
        >
          <Typography variant="h6" color="error.dark">
            Something went wrong
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {this.state.error?.message}
          </Typography>
          <Button 
            variant="contained" 
            sx={{ mt: 2 }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<div>Loading...</div>}>
  <Dashboard />
</ErrorBoundary>
```

**Key Points:**
- Class component for error boundaries
- Implement `getDerivedStateFromError`
- Log errors in `componentDidCatch`
- Provide user-friendly fallback UI
- Add recovery actions (reload, retry)

---

### 5. Form Handling Pattern (React Hook Form)

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, Button, Box } from '@mui/material';

const appointmentSchema = z.object({
  service_id: z.number().positive('Service is required'),
  appointment_date: z.string().min(1, 'Date is required'),
  appointment_time: z.string().regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    'Time must be in HH:MM format'
  ),
  customer_name: z.string().min(2, 'Name must be at least 2 characters'),
  customer_phone: z.string().regex(
    /^\+?[\d\s-]{10,}$/,
    'Invalid phone number'
  ),
  notes: z.string().max(500).optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  onSubmit: (data: AppointmentFormData) => void;
  onCancel: () => void;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      service_id: undefined,
      appointment_date: '',
      appointment_time: '',
      customer_name: '',
      customer_phone: '',
      notes: '',
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Controller
        name="customer_name"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Customer Name"
            error={!!errors.customer_name}
            helperText={errors.customer_name?.message}
            fullWidth
          />
        )}
      />
      
      <Controller
        name="appointment_date"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            error={!!errors.appointment_date}
            helperText={errors.appointment_date?.message}
            fullWidth
          />
        )}
      />
      
      <Controller
        name="appointment_time"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Time"
            type="time"
            InputLabelProps={{ shrink: true }}
            error={!!errors.appointment_time}
            helperText={errors.appointment_time?.message}
            fullWidth
          />
        )}
      />
      
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Book Appointment'}
        </Button>
      </Box>
    </Box>
  );
};
```

**Key Points:**
- Use React Hook Form for complex forms
- Use Zod for schema validation
- Use `Controller` for MUI components
- Show loading state during submission
- Display validation errors inline

---

### 6. API Client Pattern (Axios)

```tsx
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API service
export const appointmentApi = {
  getAll: async (params?: { salonId?: number; status?: string }) => {
    const { data } = await apiClient.get('/appointments', { params });
    return data;
  },
  
  getById: async (id: number) => {
    const { data } = await apiClient.get(`/appointments/${id}`);
    return data;
  },
  
  create: async (appointmentData: AppointmentCreate) => {
    const { data } = await apiClient.post('/appointments', appointmentData);
    return data;
  },
  
  update: async (id: number, appointmentData: Partial<Appointment>) => {
    const { data } = await apiClient.put(`/appointments/${id}`, appointmentData);
    return data;
  },
  
  delete: async (id: number) => {
    await apiClient.delete(`/appointments/${id}`);
  },
};
```

**Key Points:**
- Centralized API client configuration
- Request interceptor for auth token
- Response interceptor for error handling
- Auto-logout on 401
- Type-safe API methods

---

### 7. Loading State Pattern

```tsx
import { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => (
  <Box 
    sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '200px',
      gap: 2
    }}
  >
    <CircularProgress />
    {message && (
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    )}
  </Box>
);

// Usage with Suspense
<Suspense fallback={<LoadingSpinner message="Loading dashboard..." />}>
  <Dashboard />
</Suspense>

// Usage with React Query
const { data, isLoading } = useAppointments();

if (isLoading) {
  return <LoadingSpinner message="Loading appointments..." />;
}

return <AppointmentList appointments={data} />;
```

**Key Points:**
- Reusable loading component
- Optional loading message
- Use with Suspense for code splitting
- Use with React Query for data loading
- Consistent loading UX

---

### 8. Optimistic Update Pattern

```tsx
const updateAppointment = useMutation({
  mutationFn: ({ id, data }: { id: number; data: AppointmentUpdate }) =>
    appointmentApi.update(id, data),
  
  // Optimistically update cache
  onMutate: async ({ id, data }) => {
    await queryClient.cancelQueries({ queryKey: ['appointments'] });
    
    const previousAppointments = queryClient.getQueryData(['appointments']);
    
    queryClient.setQueryData(['appointments'], (old: any) => ({
      ...old,
      items: old.items.map((apt: Appointment) =>
        apt.id === id ? { ...apt, ...data } : apt
      ),
    }));
    
    return { previousAppointments };
  },
  
  // Rollback on error
  onError: (err, variables, context) => {
    if (context?.previousAppointments) {
      queryClient.setQueryData(
        ['appointments'],
        context.previousAppointments
      );
    }
  },
  
  // Refetch after success/error
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
  },
});
```

**Key Points:**
- Cancel outgoing queries
- Save previous state for rollback
- Update cache immediately
- Rollback on error
- Refetch to sync with server

---

## ✅ Checklist

Before committing React code:

- [ ] TypeScript types defined for all props
- [ ] Functional components with hooks
- [ ] Proper error handling
- [ ] Loading states implemented
- [ ] Form validation in place
- [ ] API errors handled gracefully
- [ ] Responsive design tested
- [ ] Accessibility considered (ARIA, keyboard nav)
- [ ] No hardcoded values (use theme tokens)
- [ ] Components are reusable

---

## 🚫 Anti-Patterns

### ❌ Don't: Class components (unless necessary)
```tsx
// BAD
class AppointmentList extends Component {
  state = { appointments: [] };
  
  componentDidMount() {
    this.fetchAppointments();
  }
}
```

### ✅ Do: Functional components with hooks
```tsx
// GOOD
const AppointmentList = () => {
  const { data: appointments, isLoading } = useAppointments();
  
  if (isLoading) return <LoadingSpinner />;
  return <List appointments={appointments} />;
};
```

### ❌ Don't: Prop drilling
```tsx
// BAD
<Appointments user={user} token={token} onLogout={handleLogout}>
  <AppointmentList user={user} token={token}>
    <AppointmentCard user={user} />
  </AppointmentList>
</Appointments>
```

### ✅ Do: Context or Zustand
```tsx
// GOOD
const UserProfile = () => {
  const { user, logout } = useAuthStore();
  return <Box>{user?.name}</Box>;
};
```

### ❌ Don't: Inline styles
```tsx
// BAD
<div style={{ marginLeft: '16px', color: '#333' }}>Text</div>
```

### ✅ Do: MUI sx prop or styled components
```tsx
// GOOD
<Box sx={{ ml: 2, color: 'text.primary' }}>Text</Box>
```

---

## 📚 Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)
- [Material-UI](https://mui.com/material-ui/)
- Project frontend: `frontend/src/`

---

**Last Updated:** 2026-03-25  
**Version:** 1.0.0
