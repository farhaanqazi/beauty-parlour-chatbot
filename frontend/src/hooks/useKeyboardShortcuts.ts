import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const baseRoute = user.role === 'admin'
      ? '/admin'
      : user.role === 'salon_owner'
      ? '/salon'
      : '/reception';

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigate(`${baseRoute}/appointments`);
            break;
          case '2':
            if (user.role !== 'reception') {
              e.preventDefault();
              navigate(user.role === 'admin' ? '/admin/salons' : '/salon/services');
            }
            break;
          case ',':
            if (user.role !== 'reception') {
              e.preventDefault();
              navigate(user.role === 'admin' ? '/admin/users' : '/salon/settings');
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user, navigate]);
};
