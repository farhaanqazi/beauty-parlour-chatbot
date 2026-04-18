import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Scissors,
  Settings,
  CalendarX,
  LogOut,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

export const DRAWER_EXPANDED = 240;
export const DRAWER_COLLAPSED = 64;

const NAV_ITEMS: Record<UserRole, { label: string; icon: ReactNode; path: string }[]> = {
  admin: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} />, path: '/dashboard' },
    { label: 'Appointments', icon: <Calendar className="w-5 h-5" strokeWidth={2} />, path: '/owner/appointments' },
    { label: 'Users', icon: <Users className="w-5 h-5" strokeWidth={2} />, path: '/admin/users' },
    { label: 'Customers', icon: <Users className="w-5 h-5" strokeWidth={2} />, path: '/customers' },
    { label: 'Analytics', icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} />, path: '/analytics' },
  ],
  salon_owner: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} />, path: '/owner/dashboard' },
    { label: 'Appointments', icon: <Calendar className="w-5 h-5" strokeWidth={2} />, path: '/owner/appointments' },
    { label: 'Services', icon: <Scissors className="w-5 h-5" strokeWidth={2} />, path: '/owner/services' },
    { label: 'Customers', icon: <Users className="w-5 h-5" strokeWidth={2} />, path: '/customers' },
    { label: 'Closure', icon: <CalendarX className="w-5 h-5" strokeWidth={2} />, path: '/salon/closure' },
    { label: 'Settings', icon: <Settings className="w-5 h-5" strokeWidth={2} />, path: '/salon/settings' },
  ],
  reception: [
    { label: 'Appointments', icon: <Calendar className="w-5 h-5" strokeWidth={2} />, path: '/owner/appointments' },
    { label: 'Customers', icon: <Users className="w-5 h-5" strokeWidth={2} />, path: '/customers' },
  ],
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const items = NAV_ITEMS[user.role];
  const width = collapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  return (
    <aside
      className="fixed top-0 left-0 z-30 h-full bg-[var(--color-surface-base)]/80 backdrop-blur-xl border-r border-[var(--color-neutral-800)] transition-all duration-250 ease-in-out overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-${collapsed ? 2 : 4} py-3 min-h-[64px]`}
      >
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <span className="text-base font-bold bg-gradient-to-r from-[var(--color-accent)] to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                Beauty Parlour
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="p-2 rounded-xl text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-100)] hover:bg-[var(--color-surface-overlay)] transition-colors focus-ring"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <Menu className="w-5 h-5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 pt-3 px-2 overflow-y-auto">
        {items.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <div key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-start'} min-h-[48px] px-${collapsed ? 3 : 4} mb-1 rounded-xl transition-all ${active
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-sm shadow-[var(--color-accent)]/5'
                    : 'text-[var(--color-neutral-100)] hover:bg-[var(--color-surface-overlay)]'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`${active ? 'text-[var(--color-accent)] scale-110' : 'text-[var(--color-neutral-300)]'} transition-transform`}>
                  {item.icon}
                </span>
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap ml-6"
                    >
                      <span className={`text-sm ${active ? 'font-bold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4">
        <button
          onClick={logout}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-start'} min-h-[48px] px-${collapsed ? 3 : 4} mb-1 rounded-xl transition-all text-[var(--color-neutral-100)] hover:text-rose-400 hover:bg-rose-500/10`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 text-[var(--color-neutral-300)] transition-colors" strokeWidth={2} />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap ml-6"
              >
                <span className="text-sm font-medium">Logout</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
