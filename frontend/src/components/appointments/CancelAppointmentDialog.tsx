import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import TailwindModal from '../common/TailwindModal';
import TailwindInput from '../common/TailwindInput';
import { useCancelAppointment } from '../../hooks/useAppointments';
import { AlertCircle, Loader } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

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

  const actions = (
    <div className="flex gap-3 justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="cancel-appointment-form"
        disabled={isSubmitting}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            <span>Cancelling...</span>
          </>
        ) : (
          'Confirm Cancellation'
        )}
      </button>
    </div>
  );

  return (
    <TailwindModal
      isOpen={open}
      onClose={onClose}
      title="Cancel Appointment"
      actions={actions}
      size="sm"
    >
      <form id="cancel-appointment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </AnimatePresence>

        {/* Cancellation Reason Input */}
        <TailwindInput
          label="Reason for cancellation"
          multiline
          rows={4}
          {...register('reason')}
          error={errors.reason?.message}
          helperText={errors.reason?.message}
          disabled={isSubmitting}
        />
      </form>
    </TailwindModal>
  );
};

export default CancelAppointmentDialog;
