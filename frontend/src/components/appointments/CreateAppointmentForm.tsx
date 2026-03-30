import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
  MenuItem,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useCreateAppointment } from '../../hooks/useAppointments';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  salon_id: z.string().uuid('Invalid salon ID'),
  customer_id: z.string().uuid('Invalid customer ID'),
  service_id: z.string().uuid('Invalid service ID'),
  appointment_at: z.string().min(1, 'Appointment date/time is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateAppointmentFormProps {
  open: boolean;
  onClose: () => void;
}

// Placeholder options - in real app, these would be fetched from API
const placeholderServices = [
  { id: 'service-1', name: 'Bridal Makeup' },
  { id: 'service-2', name: 'Hair Styling' },
  { id: 'service-3', name: 'Facial Treatment' },
];

const CreateAppointmentForm = ({ open, onClose }: CreateAppointmentFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const { user } = useAuthStore();
  const createMutation = useCreateAppointment();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await createMutation.mutateAsync({
        ...data,
        appointment_at: appointmentDate?.toISOString() || '',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create appointment. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Appointment</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {/* Salon ID - Admin only */}
          {user?.role === 'admin' && (
            <TextField
              label="Salon ID"
              fullWidth
              margin="normal"
              {...register('salon_id')}
              error={!!errors.salon_id}
              helperText={errors.salon_id?.message}
              disabled={isSubmitting}
              placeholder="Enter salon UUID"
            />
          )}
          
          {/* Customer ID */}
          <TextField
            label="Customer ID"
            fullWidth
            margin="normal"
            {...register('customer_id')}
            error={!!errors.customer_id}
            helperText={errors.customer_id?.message}
            disabled={isSubmitting}
            placeholder="Enter customer UUID"
          />
          
          {/* Service Selection */}
          <TextField
            select
            label="Service"
            fullWidth
            margin="normal"
            {...register('service_id')}
            error={!!errors.service_id}
            helperText={errors.service_id?.message}
            disabled={isSubmitting}
          >
            {placeholderServices.map((service) => (
              <MenuItem key={service.id} value={service.id}>
                {service.name}
              </MenuItem>
            ))}
          </TextField>
          
          {/* Appointment Date/Time */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Appointment Date & Time"
              value={appointmentDate}
              onChange={(newValue) => {
                setAppointmentDate(newValue);
                if (newValue) {
                  setValue('appointment_at', newValue.toISOString());
                }
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: 'normal',
                  error: !!errors.appointment_at,
                  helperText: errors.appointment_at?.message,
                },
              }}
              disabled={isSubmitting}
            />
          </LocalizationProvider>
          
          {/* Notes */}
          <TextField
            label="Notes (optional)"
            multiline
            rows={3}
            fullWidth
            margin="normal"
            {...register('notes')}
            error={!!errors.notes}
            helperText={errors.notes?.message}
            disabled={isSubmitting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Create Appointment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateAppointmentForm;
