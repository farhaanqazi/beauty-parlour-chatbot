import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Store, ChevronDown, Check, Star, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { fetchSalons, type Salon } from '../../services/dashboardApi';
import NotificationBell from './NotificationBell';
import { DRAWER_EXPANDED, DRAWER_COLLAPSED } from './Sidebar';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

const Header = ({ sidebarCollapsed }: HeaderProps) => {
  const { user } = useAuthStore();
  const { mode, toggleMode } = useThemeStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const width = sidebarCollapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;
  const [selectedSalonName, setSelectedSalonName] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setSelectedSalonName(localStorage.getItem('selectedSalonName'));
  }, []);

  // Fetch salons list ONLY if user is admin
  const { data: salons } = useQuery({
    queryKey: ['salons', 'list'],
    queryFn: fetchSalons,
    enabled: user?.role === 'admin',
    staleTime: 60000,
  });

  const currentSalonId = localStorage.getItem('selectedSalonId');

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSalonSwitch = (salon: Salon) => {
    localStorage.setItem('selectedSalonId', salon.id);
    localStorage.setItem('selectedSalonName', salon.name);
    setIsDropdownOpen(false);
    // Hard reload to reset all query caches and states for the new salon context
    window.location.reload();
  };

  return (
    <header
      className="fixed top-0 z-40 bg-[var(--color-surface-base)]/80 backdrop-blur-xl border-b border-[var(--color-neutral-800)] text-[var(--color-neutral-100)] transition-all duration-250 ease-in-out"
      style={{
        width: `calc(100% - ${width}px)`,
        marginLeft: `${width}px`,
      }}
    >
      <div className="flex items-center gap-4 px-6 h-16">
        
        {/* Left: Branded Salon Switcher / Name */}
        <div className="flex items-center gap-4 flex-1">
          {selectedSalonName ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => user?.role === 'admin' && setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center gap-3 p-1.5 pr-4 rounded-2xl transition-all group ${
                  user?.role === 'admin' 
                    ? 'hover:bg-[var(--color-surface-raised)] active:scale-[0.98] cursor-pointer' 
                    : 'cursor-default'
                }`}
              >
                {/* Branded Icon - Unified Design */}
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-accent)] to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20 group-hover:shadow-[var(--color-accent)]/30 transition-all">
                  <Star className="w-6 h-6 text-[var(--color-surface-base)]" strokeWidth={2} />
                </div>
                
                <div className="flex flex-col items-start">
                  <span className="text-sm font-black text-[var(--color-neutral-100)] tracking-tight flex items-center gap-2">
                    {selectedSalonName}
                    {user?.role === 'admin' && (
                      <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-neutral-500)] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-neutral-500)] uppercase tracking-widest">
                    {user?.role === 'admin' ? 'Admin Controller' : 'Salon Hub'}
                  </span>
                </div>
              </button>

              {/* Responsive Dropdown Menu */}
              <AnimatePresence>
                {isDropdownOpen && user?.role === 'admin' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full left-0 mt-2 w-72 bg-[var(--color-surface-raised)] border border-[var(--color-neutral-700)] rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl py-3 z-50"
                  >
                    <div className="px-4 py-2 mb-2">
                      <h4 className="text-[10px] font-black text-[var(--color-neutral-500)] uppercase tracking-[0.2em]">Switch Salon</h4>
                    </div>
                    
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar px-2 space-y-1">
                      {salons?.map((salon) => (
                        <button
                          key={salon.id}
                          onClick={() => handleSalonSwitch(salon)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all group ${
                            currentSalonId === salon.id
                              ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20'
                              : 'hover:bg-[var(--color-neutral-800)] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              currentSalonId === salon.id 
                                ? 'bg-[var(--color-accent)] text-[var(--color-surface-base)]' 
                                : 'bg-[var(--color-neutral-700)] text-[var(--color-neutral-400)] group-hover:bg-[var(--color-neutral-600)]'
                            }`}>
                              <Store className="w-4 h-4" />
                            </div>
                            <span className={`text-sm font-bold ${currentSalonId === salon.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-neutral-300)]'}`}>
                              {salon.name}
                            </span>
                          </div>
                          {currentSalonId === salon.id && (
                            <Check className="w-4 h-4 text-[var(--color-accent)]" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-neutral-800)] rounded-xl animate-pulse" />
              <div className="w-32 h-4 bg-[var(--color-neutral-800)] rounded animate-pulse" />
            </div>
          )}
        </div>

        {/* Right Section Actions */}
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <NotificationBell />

            <button
              onClick={toggleMode}
              className="p-3 rounded-xl hover:bg-[var(--color-neutral-800)] transition-colors focus-ring"
              aria-label="Toggle theme"
              title={mode === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              {mode === 'dark' ? (
                <Sun className="w-5 h-5 text-[var(--color-neutral-300)]" strokeWidth={2} />
              ) : (
                <Moon className="w-5 h-5 text-[var(--color-neutral-300)]" strokeWidth={2} />
              ) }
            </button>
          </div>

          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-[var(--color-neutral-800)]">
              <div className="flex flex-col items-end hidden md:flex">
                <span className="text-sm font-bold text-[var(--color-neutral-100)] truncate max-w-[150px]">
                  {user.full_name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-neutral-500)] font-mono">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-amber-600 flex items-center justify-center text-[var(--color-surface-base)] font-bold text-sm shadow-lg shadow-[var(--color-accent)]/20 ring-2 ring-[var(--color-surface-base)]">
                {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
