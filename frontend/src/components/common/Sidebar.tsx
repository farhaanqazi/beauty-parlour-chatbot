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
    { label: 'Appointments', icon: <Calendar className="w-5 h-5" strokeWidth={2} />, path: '/admin/appointments' },
    { label: 'Salons', icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} />, path: '/admin/salons' },
    { label: 'Users', icon: <Users className="w-5 h-5" strokeWidth={2} />, path: '/admin/users' },
    { label: 'Analytics', icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} />, path: '/admin/analytics' },
  ],
  salon_owner: [
    { label: 'Appointments', icon: <Calendar className="w-5 h-5" strokeWidth={2} />, path: '/salon/appointments' },
    { label: 'Services', icon: <Scissors className="w-5 h-5" strokeWidth={2} />, path: '/salon/services' },
    { label: 'Closure', icon: <CalendarX className="w-5 h-5" strokeWidth={2} />, path: '/salon/closure' },
    { label: 'Settings', icon: <Settings className="w-5 h-5" strokeWidth={2} />, path: '/salon/settings' },
  ],
  reception: [
    { label: 'Appointments', icon: <Calendar className="w-5 h-5" strokeWidth={2} />, path: '/reception/appointments' },
    { label: 'Customers', icon: <Users className="w-5 h-5" strokeWidth={2} />, path: '/reception/customers' },
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
      className="fixed top-0 left-0 z-30 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-white/10 transition-all duration-250 ease-in-out overflow-hidden"
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
              <span className="text-base font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                Beauty Parlour
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-start'} min-h-[44px] px-${collapsed ? 3 : 4} mx-2 mb-1 rounded-xl transition-colors ${
                  active
                    ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`${active ? 'text-purple-700 dark:text-purple-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {item.icon}
                </span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap ml-6"
                    >
                      <span className={`text-sm font-medium ${active ? 'font-bold' : ''}`}>
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
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-start'} min-h-[44px] px-${collapsed ? 3 : 4} mx-2 mb-1 rounded-xl transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 text-neutral-500 dark:text-neutral-400" strokeWidth={2} />
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
