import { Link as RouterLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  salon: 'Salon',
  reception: 'Reception',
  appointments: 'Appointments',
  services: 'Services',
  settings: 'Settings',
  closure: 'Closure',
  customers: 'Customers',
  salons: 'Salons',
  users: 'Users',
  analytics: 'Analytics',
};

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const AppBreadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/');
    const label = isUuid(seg) ? 'Detail' : (SEGMENT_LABELS[seg] ?? seg);
    const isLast = i === segments.length - 1;
    return { path, label, isLast };
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-2">
          {/* Separator Chevron */}
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" aria-hidden="true" />
          )}
          
          {/* Crumb Link or Text */}
          {crumb.isLast ? (
            <span
              className="text-neutral-600 font-semibold"
              aria-current="page"
            >
              {crumb.label}
            </span>
          ) : (
            <RouterLink
              to={crumb.path}
              className="text-blue-600 hover:underline hover:text-blue-700 transition-colors"
            >
              {crumb.label}
            </RouterLink>
          )}
        </div>
      ))}
    </nav>
  );
};

export default AppBreadcrumbs;
