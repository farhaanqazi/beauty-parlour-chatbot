import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TailwindModal from '../common/TailwindModal';
import TailwindInput from '../common/TailwindInput';
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
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const { user } = useAuthStore();
  const { mutateAsync, isPending } = useCreateAppointment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      salon_id: user?.role !== 'admin' && user?.salon_id ? user.salon_id : '',
    },
  });

  const handleClose = () => {
    reset();
    setAppointmentDate(null);
    setApiError(null);
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    if (!appointmentDate) {
      setApiError('Please select an appointment date and time');
      return;
    }
    setApiError(null);
    try {
      await mutateAsync({
        salon_id: data.salon_id,
        customer_id: data.customer_id,
        service_id: data.service_id,
        appointment_at: appointmentDate.toISOString(),
        notes: data.notes,
      });
      reset();
      setAppointmentDate(null);
      onSuccess();
      handleClose();
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setApiError(error.response?.data?.detail || 'Failed to create appointment. Please try again.');
    }
  };

  const formContent = (
    <div className="space-y-4">
      {apiError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">{apiError}</span>
        </div>
      )}

      {user?.role === 'admin' && (
        <TailwindInput
          label="Salon ID"
          placeholder="Enter salon UUID"
          disabled={isPending}
          {...register('salon_id')}
          error={errors.salon_id?.message}
        />
      )}

      <TailwindInput
        label="Customer ID"
        placeholder="Enter customer UUID"
        disabled={isPending}
        {...register('customer_id')}
        error={errors.customer_id?.message}
      />

      <TailwindInput
        label="Service ID"
        placeholder="Enter service UUID"
        disabled={isPending}
        {...register('service_id')}
        error={errors.service_id?.message}
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Appointment Date & Time *
        </label>
        <DatePicker
          selected={appointmentDate}
          onChange={(date: Date | null) => {
            setAppointmentDate(date);
            if (date) {
              setValue('appointment_at', date);
            }
          }}
          showTimeSelect
          timeIntervals={30}
          dateFormat="MMM d, yyyy h:mm aa"
          disabled={isPending}
          className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-500"
          placeholderText="Select date and time"
        />
      </div>

      <TailwindInput
        label="Notes (optional)"
        placeholder="Add any notes"
        disabled={isPending}
        multiline
        rows={3}
        {...register('notes')}
      />
    </div>
  );

  const actions = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleClose}
        disabled={isPending}
        className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg disabled:opacity-50 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending || !isValid || !appointmentDate}
        onClick={handleSubmit(onSubmit)}
        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader className="w-4 h-4 animate-spin" /> : null}
        {isPending ? 'Creating...' : 'Create Appointment'}
      </button>
    </div>
  );

  return (
    <TailwindModal
      isOpen={open}
      onClose={handleClose}
      title="New Appointment"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {formContent}
        {actions}
      </form>
    </TailwindModal>
  );
};

export default CreateAppointmentDialog;
