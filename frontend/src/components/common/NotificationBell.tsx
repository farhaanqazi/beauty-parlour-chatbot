import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../services/supabaseClient';
import { useAuthStore } from '../../store/authStore';

interface Notification {
  id: string;
  booking_reference: string;
  customer_name: string;
  service_name: string;
  appointment_at: string;
  read: boolean;
  created_at: string;
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel('new-appointments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: user.role !== 'admin' && user.salon_id
            ? `salon_id=eq.${user.salon_id}`
            : undefined,
        },
        (payload) => {
          const appt = payload.new as { id: string; booking_reference: string; appointment_at: string; created_at: string; };
          setNotifications((prev) => [
            {
              id: appt.id,
              booking_reference: appt.booking_reference,
              customer_name: 'New booking',
              service_name: '',
              appointment_at: appt.appointment_at,
              read: false,
              created_at: appt.created_at,
            },
            ...prev.slice(0, 19),
          ]);
        }
      )
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = () => {
    setIsOpen(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-300" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-medium text-white bg-rose-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-white/10 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/10">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              Notifications
            </h3>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No new notifications
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b border-neutral-100 dark:border-white/5 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">
                      New Booking
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {n.booking_reference}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {format(parseISO(n.appointment_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
