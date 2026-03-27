import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { currentQuarter } from '@/data/mockData';

interface Props {
  onMenuClick: () => void;
}

export default function CustomerTopBar({ onMenuClick }: Props) {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
      <button onClick={onMenuClick} className="md:hidden text-muted-foreground hover:text-foreground active:scale-[0.95] transition-all">
        <Menu className="w-5 h-5" />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent">
          {currentQuarter.label}
        </span>
        <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-none">{user?.name}</span>
      </div>
    </header>
  );
}