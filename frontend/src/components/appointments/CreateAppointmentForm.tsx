import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TailwindInput from '../common/TailwindInput';
import TailwindSelect from '../common/TailwindSelect';
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
    if (!appointmentDate) {
      setError('Please select an appointment date and time');
      return;
    }
    setError(null);
    try {
      await createMutation.mutateAsync({
        ...data,
        appointment_at: appointmentDate.toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create appointment. Please try again.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">New Appointment</h2>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Salon ID - Admin only */}
          {user?.role === 'admin' && (
            <TailwindInput
              label="Salon ID"
              placeholder="Enter salon UUID"
              disabled={isSubmitting}
              {...register('salon_id')}
              error={errors.salon_id?.message}
            />
          )}

          {/* Customer ID */}
          <TailwindInput
            label="Customer ID"
            placeholder="Enter customer UUID"
            disabled={isSubmitting}
            {...register('customer_id')}
            error={errors.customer_id?.message}
          />

          {/* Service Selection */}
          <TailwindSelect
            label="Service"
            options={placeholderServices.map((service) => ({
              value: service.id,
              label: service.name,
            }))}
            disabled={isSubmitting}
            placeholder="Select a service"
            {...register('service_id')}
            error={errors.service_id?.message}
          />

          {/* Appointment Date/Time */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Appointment Date & Time *
            </label>
            <DatePicker
              selected={appointmentDate}
              onChange={(date: Date | null) => {
                setAppointmentDate(date);
                if (date) {
                  setValue('appointment_at', date.toISOString());
                }
              }}
              showTimeSelect
              timeIntervals={30}
              dateFormat="MMM d, yyyy h:mm aa"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholderText="Select date and time"
            />
            {errors.appointment_at && (
              <p className="text-xs text-red-600 mt-1">{errors.appointment_at.message}</p>
            )}
          </div>

          {/* Notes */}
          <TailwindInput
            label="Notes (optional)"
            placeholder="Add any notes"
            disabled={isSubmitting}
            multiline
            rows={3}
            {...register('notes')}
            error={errors.notes?.message}
          />
        </form>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !appointmentDate}
            onClick={handleSubmit(onSubmit)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting ? 'Creating...' : 'Create Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAppointmentForm;
