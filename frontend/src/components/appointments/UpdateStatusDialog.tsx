import { useState } from 'react';
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
import { useUpdateAppointmentStatus } from '../../hooks/useAppointments';
import type { AppointmentStatus } from '../../types';

interface UpdateStatusDialogProps {
  open: boolean;
  appointmentId: string;
  currentStatus: AppointmentStatus;
  onClose: () => void;
}

// Define valid status transitions
const statusTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'no_show'],
  confirmed: ['completed', 'no_show'],
  cancelled_by_client: [],
  cancelled_by_salon: [],
  cancelled_by_reception: [],
  cancelled_closure: [],
  completed: [],
  no_show: [],
};

const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled_by_client: 'Cancelled by Client',
  cancelled_by_salon: 'Cancelled by Salon',
  cancelled_by_reception: 'Cancelled by Reception',
  cancelled_closure: 'Cancelled Closure',
  no_show: 'No Show',
};

const UpdateStatusDialog = ({ open, appointmentId, currentStatus, onClose }: UpdateStatusDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<AppointmentStatus>(currentStatus);
  const updateMutation = useUpdateAppointmentStatus();

  const allowedTransitions = statusTransitions[currentStatus] || [];

  const handleSubmit = async () => {
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: appointmentId, status: newStatus });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update status. Please try again.');
    }
  };

  const cannotChange = allowedTransitions.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Appointment Status</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {cannotChange ? (
          <Alert severity="info">
            Status cannot be changed from {statusLabels[currentStatus]}.
          </Alert>
        ) : (
          <TextField
            select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as AppointmentStatus)}
            fullWidth
            disabled={updateMutation.isPending}
          >
            {allowedTransitions.map((status) => (
              <MenuItem key={status} value={status}>
                {statusLabels[status]}
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={updateMutation.isPending || cannotChange}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={updateMutation.isPending || cannotChange}
        >
          {updateMutation.isPending ? <CircularProgress size={24} /> : 'Update Status'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateStatusDialog;
