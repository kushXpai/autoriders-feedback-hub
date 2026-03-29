import { LayoutDashboard, FileText, History, LogOut, ChevronLeft, ChevronRight, X, UserCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/customer' },
  { label: 'Feedback Form', icon: FileText, path: '/customer/feedback' },
  { label: 'Previous Feedback', icon: History, path: '/customer/history' },
  { label: 'Profile', icon: UserCircle, path: '/customer/profile' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function CustomerSidebar({ open, onClose, collapsed, setCollapsed }: Props) {
  const { logout } = useAuth();

  const sidebarContent = (
    <aside
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-out relative shrink-0',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in">
            <div className="w-12 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <img
                src="/autoriders.webp"
                alt="Autoriders Logo"
                className="w-28 object-contain"
              />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">Car Rental</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">Feedback System</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mx-auto">
            <span className="text-xs font-bold text-accent-foreground">EM</span>
          </div>
        )}
        {/* Close button on mobile */}
        <button onClick={onClose} className="md:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 px-3 space-y-1.5">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/customer'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                'hover:bg-sidebar-accent/60 active:scale-[0.97]',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70'
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all w-full active:scale-[0.97]"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
          <div className="fixed left-0 top-0 z-50 md:hidden animate-fade-in">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}