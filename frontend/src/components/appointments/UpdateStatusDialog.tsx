import { useState } from 'react';
import TailwindModal from '../common/TailwindModal';
import TailwindSelect from '../common/TailwindSelect';
import { useUpdateAppointmentStatus } from '../../hooks/useAppointments';
import type { AppointmentStatus } from '../../types';
import { AlertCircle, Loader } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

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
  cancelled_by_user: [],
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
  cancelled_by_user: 'Cancelled by User',
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

  // Prepare options for TailwindSelect
  const statusOptions = allowedTransitions.map((status) => ({
    value: status,
    label: statusLabels[status],
  }));

  const actions = (
    <div className="flex gap-3 justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={updateMutation.isPending || cannotChange}
        className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={updateMutation.isPending || cannotChange}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {updateMutation.isPending ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            <span>Updating...</span>
          </>
        ) : (
          'Update Status'
        )}
      </button>
    </div>
  );

  return (
    <TailwindModal
      isOpen={open}
      onClose={onClose}
      title="Update Appointment Status"
      actions={actions}
      size="sm"
    >
      <div className="space-y-4">
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </AnimatePresence>

        {/* Status Info or Select */}
        {cannotChange ? (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-700">
              Status cannot be changed from{' '}
              <span className="font-semibold">{statusLabels[currentStatus]}</span>.
            </span>
          </div>
        ) : (
          <TailwindSelect
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as AppointmentStatus)}
            options={statusOptions}
            disabled={updateMutation.isPending}
          />
        )}
      </div>
    </TailwindModal>
  );
};

export default UpdateStatusDialog;
