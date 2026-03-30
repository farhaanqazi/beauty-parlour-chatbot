import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Calendar, Clock, User, Phone, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSalonServices, createAppointment } from '../../services/dashboardApi';
import type { CreateAppointmentPayload } from '../../services/dashboardApi';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonId: string | undefined;
}

const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({ isOpen, onClose, salonId }) => {
  const queryClient = useQueryClient();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  
  const [successMode, setSuccessMode] = useState(false);

  // Fetch Services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['salonServices', salonId],
    queryFn: () => fetchSalonServices(salonId!),
    enabled: !!salonId && isOpen,
    staleTime: 300000, // 5 min
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateAppointmentPayload) => createAppointment(payload),
    onSuccess: () => {
      // Magically refresh everything on the dashboard
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSuccessMode(true);
      setTimeout(() => {
        closeAndReset();
      }, 2000);
    },
  });

  const closeAndReset = () => {
    onClose();
    setTimeout(() => {
      setCustomerName('');
      setCustomerPhone('');
      setServiceId('');
      setDate('');
      setTime('');
      setNotes('');
      setSuccessMode(false);
      mutation.reset();
    }, 300); // Wait for exit animation
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;

    // Construct ISO string for datetime
    const datetimeString = `${date}T${time}:00`;
    let appointmentAt;
    try {
      appointmentAt = new Date(datetimeString).toISOString();
    } catch (err) {
      console.error("Invalid date");
      return;
    }

    mutation.mutate({
      salon_id: salonId,
      customer_name: customerName,
      customer_phone: customerPhone,
      service_id: serviceId,
      appointment_at: appointmentAt,
      notes: notes || undefined,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAndReset}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {successMode ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-emerald-500" />
                </motion.div>
                <h2 className="text-2xl font-bold text-neutral-800">Appointment Booked!</h2>
                <p className="text-neutral-500 text-center">The dashboard is automatically updating.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                  <h2 className="text-lg font-bold text-neutral-800">New Appointment</h2>
                  <button
                    onClick={closeAndReset}
                    className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  
                  {/* Customer Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-neutral-700">Customer Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="Jane Doe"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-neutral-700">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Service Selection */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">Service</label>
                    <select
                      required
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
                    >
                      <option value="" disabled>Select a service...</option>
                      {servicesLoading ? (
                        <option disabled>Loading services...</option>
                      ) : (
                        services?.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name} - {svc.duration_minutes} min
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-neutral-700">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-neutral-700">Time</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <input
                          type="time"
                          required
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">Optional Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                      placeholder="Customer preferences..."
                    />
                  </div>

                  {/* Error State */}
                  {mutation.isError && (
                    <div className="p-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
                      Failed to create appointment. Please check the fields and try again.
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="w-full relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-75 text-white font-medium rounded-xl shadow-lg shadow-blue-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Booking...</span>
                        </>
                      ) : (
                        <span>Book Appointment</span>
                      )}
                    </button>
                  </div>

                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NewAppointmentModal;
