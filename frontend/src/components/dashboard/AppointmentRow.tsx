import { motion } from 'framer-motion';
import type { DashboardAppointment } from '../../services/dashboardApi';

interface Props {
  appointment: DashboardAppointment;
  onClick?: () => void;
}

const statusColorMap: Record<string, string> = {
  pending: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border-[var(--color-warning)]/20',
  confirmed: 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/20',
  completed: 'bg-[var(--color-info)]/20 text-[var(--color-info)] border-[var(--color-info)]/20',
  cancelled: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)] border-[var(--color-danger)]/20',
};

const AppointmentRow = ({ appointment, onClick }: Props) => {
  const appointmentDate = new Date(appointment.appointment_at).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const appointmentTime = new Date(appointment.appointment_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-4 border-b border-[var(--color-neutral-800)] hover:bg-[var(--color-surface-overlay)]/50 transition-colors duration-150 last:border-0 cursor-pointer"
    >
      <div>
        <p className="font-medium text-[var(--color-neutral-100)]">{appointment.customer_name}</p>
        <p className="text-xs text-[var(--color-neutral-500)]">{appointment.service_name}</p>
      </div>
      <div className="text-sm text-[var(--color-neutral-300)]">
        <div className="font-medium">{appointmentDate}</div>
        <div className="text-xs text-[var(--color-neutral-500)]">{appointmentTime}</div>
      </div>
      <div className="text-sm text-[var(--color-neutral-300)]">
        {appointment.staff_name || (
          <span className="text-[var(--color-neutral-500)] italic">Unassigned</span>
        )}
      </div>
      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border w-fit ${statusColorMap[appointment.status]}`}>
        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
      </div>
      <div className="flex justify-end">
        <button
          className="px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
          aria-label={`View details for ${appointment.customer_name}`}
        >
          View
        </button>
      </div>
    </motion.div>
  );
};

export default AppointmentRow;
