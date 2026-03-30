import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, CircularProgress, Alert
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuthStore } from '../../store/authStore';
import { useCreateAppointment } from '../../hooks/useAppointments';

const schema = z.object({
  salon_id: z.string().uuid('Invalid salon ID'),
  customer_id: z.string().uuid('Invalid customer ID'),
  service_id: z.string().uuid('Invalid service ID'),
  appointment_at: z.date({ message: 'Date and time required' }),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateAppointmentDialog = ({ open, onClose, onSuccess }: Props) => {
  const [apiError, setApiError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { mutateAsync, isPending } = useCreateAppointment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      salon_id: user?.role !== 'admin' && user?.salon_id ? user.salon_id : '',
    },
  });

  const handleClose = () => {
    reset();
    setApiError(null);
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      await mutateAsync({
        salon_id: data.salon_id,
        customer_id: data.customer_id,
        service_id: data.service_id,
        appointment_at: data.appointment_at.toISOString(),
        notes: data.notes,
      });
      reset();
      onSuccess();
      onClose();
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setApiError(error.response?.data?.detail || 'Failed to create appointment. Please try again.');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>New Appointment</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {apiError && <Alert severity="error">{apiError}</Alert>}
            {user?.role === 'admin' && (
              <TextField
                label="Salon ID"
                fullWidth
                {...register('salon_id')}
                error={!!errors.salon_id}
                helperText={errors.salon_id?.message}
                disabled={isPending}
              />
            )}
            <TextField
              label="Customer ID"
              fullWidth
              {...register('customer_id')}
              error={!!errors.customer_id}
              helperText={errors.customer_id?.message ?? 'Enter customer UUID'}
              disabled={isPending}
            />
            <TextField
              label="Service ID"
              fullWidth
              {...register('service_id')}
              error={!!errors.service_id}
              helperText={errors.service_id?.message ?? 'Enter service UUID'}
              disabled={isPending}
            />
            <Controller
              name="appointment_at"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  label="Appointment Date & Time"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  disabled={isPending}
                  slotProps={{
                    textField: {
                      error: !!errors.appointment_at,
                      helperText: errors.appointment_at?.message,
                      fullWidth: true,
                    },
                  }}
                />
              )}
            />
            <TextField
              label="Notes (optional)"
              multiline
              rows={3}
              fullWidth
              {...register('notes')}
              disabled={isPending}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending || !isValid}
            >
              {isPending ? <CircularProgress size={20} /> : 'Create Appointment'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateAppointmentDialog;
