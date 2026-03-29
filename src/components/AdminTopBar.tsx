// src/components/AdminTopBar.tsx
import { useAuth } from '@/contexts/AuthContext';
import { currentQuarter } from '@/data/mockData';
import { Bell, Menu } from 'lucide-react';

interface AdminTopBarProps {
  onMenuClick: () => void; // opens mobile sidebar drawer
}

export default function AdminTopBar({ onMenuClick }: AdminTopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors active:scale-95"
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>

        <span className="text-sm font-semibold bg-accent/15 text-accent px-3 py-1 rounded-full">
          {currentQuarter.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors active:scale-95">
          <Bell className="w-[18px] h-[18px]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            {user?.name?.split(' ').map(n => n[0]).join('') || 'A'}
          </div>
          <span className="text-sm font-medium text-foreground hidden sm:block">{user?.name}</span>
        </div>
      </div>
    </header>
  );
}