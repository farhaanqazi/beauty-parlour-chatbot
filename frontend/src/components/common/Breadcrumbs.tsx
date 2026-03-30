import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

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
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
      >
        {crumbs.map((crumb) =>
          crumb.isLast ? (
            <Typography
              key={crumb.path}
              variant="body2"
              color="text.primary"
              fontWeight={600}
            >
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={crumb.path}
              component={RouterLink}
              to={crumb.path}
              variant="body2"
              color="text.secondary"
              underline="hover"
            >
              {crumb.label}
            </Link>
          )
        )}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default AppBreadcrumbs;
