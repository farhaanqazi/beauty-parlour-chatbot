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
} from '@mui/material';
import { useCancelAppointment } from '../../hooks/useAppointments';

const schema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason must be less than 500 characters'),
});

type FormData = z.infer<typeof schema>;

interface CancelAppointmentDialogProps {
  open: boolean;
  appointmentId: string;
  onClose: () => void;
}

const CancelAppointmentDialog = ({ open, appointmentId, onClose }: CancelAppointmentDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const cancelMutation = useCancelAppointment();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await cancelMutation.mutateAsync({ id: appointmentId, reason: data.reason });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cancel Appointment</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Reason for cancellation"
            multiline
            rows={4}
            fullWidth
            required
            {...register('reason')}
            error={!!errors.reason}
            helperText={errors.reason?.message}
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
            color="error"
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Confirm Cancellation'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CancelAppointmentDialog;
