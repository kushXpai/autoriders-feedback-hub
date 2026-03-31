// src/layouts/CustomerLayout.tsx
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import CustomerSidebar from '@/components/CustomerSidebar';
import CustomerTopBar from '@/components/CustomerTopBar';

export default function CustomerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CustomerSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CustomerTopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}