import type { AppointmentStatus } from '../../types';

interface AppointmentStatusChipProps {
  status: AppointmentStatus;
}

const statusConfig: Record<AppointmentStatus, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }> = {
  pending: { label: 'Pending', color: 'default' },
  confirmed: { label: 'Confirmed', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
  cancelled_by_client: { label: 'Cancelled by Client', color: 'error' },
  cancelled_by_salon: { label: 'Cancelled by Salon', color: 'error' },
  cancelled_by_reception: { label: 'Cancelled by Reception', color: 'error' },
  cancelled_closure: { label: 'Cancelled Closure', color: 'error' },
  no_show: { label: 'No Show', color: 'warning' },
};

const colorClasses: Record<string, string> = {
  default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  primary: 'bg-blue-100 text-blue-700 border-blue-200',
  success: 'bg-green-100 text-green-700 border-green-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
};

const AppointmentStatusChip = ({ status }: AppointmentStatusChipProps) => {
  const config = statusConfig[status];
  const colorClass = colorClasses[config.color];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${colorClass}`}
    >
      {config.label}
    </span>
  );
};

export default AppointmentStatusChip;
