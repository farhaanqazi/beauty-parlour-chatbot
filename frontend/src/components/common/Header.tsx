import { Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import { DRAWER_EXPANDED, DRAWER_COLLAPSED } from './Sidebar';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

const Header = ({ sidebarCollapsed }: HeaderProps) => {
  const { user } = useAuthStore();
  const { mode, toggleMode } = useThemeStore();

  const width = sidebarCollapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  return (
    <header
      className="fixed top-0 z-40 border-b border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white transition-all duration-250 ease-in-out"
      style={{
        width: `calc(100% - ${width}px)`,
        marginLeft: `${width}px`,
      }}
    >
      <div className="flex items-center gap-4 px-4 h-16">
        <div className="flex-1 max-w-xl">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <NotificationBell />

          <button
            onClick={toggleMode}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Toggle theme"
          >
            {mode === 'dark' ? (
              <Sun className="w-5 h-5" strokeWidth={2} />
            ) : (
              <Moon className="w-5 h-5" strokeWidth={2} />
            )}
          </button>

          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900 dark:text-white truncate max-w-[150px]">
                {user.full_name}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
