import { useState } from 'react';
import type { ReactNode } from 'react';
import Sidebar, { DRAWER_EXPANDED, DRAWER_COLLAPSED } from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Header sidebarCollapsed={collapsed} />

      {/* Page content — offset by sidebar width and top header height (64px) */}
      <main
        className="transition-all duration-250 ease-in-out pt-16"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
