// src/components/AdminSidebar.tsx
import { LayoutDashboard, Users, MessageSquareText, BarChart3, Send, LogOut, ChevronLeft, ChevronRight, UserCircle, X, UsersRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Dispatch, SetStateAction } from 'react';

// ─── Role Type ────────────────────────────────────────────────────────────────

type AppRole = 'superadmin' | 'admin' | 'manager' | 'user' | 'vendor_admin' | 'customer';

// ─── Nav Items ────────────────────────────────────────────────────────────────

const ALL_NAV_ITEMS = [
  { label: 'Dashboard',     icon: LayoutDashboard,   path: '/admin',               roles: ['superadmin', 'admin', 'manager', 'user', 'vendor_admin'] },
  { label: 'Customers',     icon: Users,              path: '/admin/customers',     roles: ['superadmin', 'admin', 'manager', 'user', 'vendor_admin'] },
  { label: 'Members',       icon: UsersRound,         path: '/admin/members',       roles: ['superadmin', 'admin'] },
  { label: 'Send Feedback', icon: Send,               path: '/admin/send-feedback', roles: ['superadmin', 'admin', 'manager', 'user'] },
  { label: 'Feedback',      icon: MessageSquareText,  path: '/admin/feedback',      roles: ['superadmin', 'admin', 'manager', 'vendor_admin'] },
  { label: 'Reports',       icon: BarChart3,          path: '/admin/reports',       roles: ['superadmin', 'admin'] },
  { label: 'Profile',       icon: UserCircle,         path: '/admin/profile',       roles: ['superadmin', 'admin', 'manager', 'user', 'vendor_admin'] },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSidebar({ open, onClose, collapsed, setCollapsed }: AdminSidebarProps) {
  const { logout, user } = useAuth();
  const userRole = user?.role;

  // Filter nav items based on current user's role
  const navItems = ALL_NAV_ITEMS.filter(item =>
    item.roles.includes(userRole as AppRole)
  );

  const sidebarContent = (
    <aside
      className={cn(
        // Use dvh (dynamic viewport height) on mobile so browser chrome is accounted for.
        // Falls back to 100vh on browsers that don't support dvh.
        'h-[100dvh] bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-out relative',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Header */}
      <div className="h-16 flex-shrink-0 flex items-center px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in flex-1 min-w-0">
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
            {/* Close button — mobile only */}
            <button
              onClick={onClose}
              className="ml-auto md:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mx-auto">
            <span className="text-xs font-bold text-accent-foreground">EM</span>
          </div>
        )}
      </div>

      {/* Nav — scrollable so it never pushes logout off screen */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
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

      {/* Logout — flex-shrink-0 keeps it always pinned at the bottom */}
      <div className="flex-shrink-0 p-3 border-t border-sidebar-border">
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
        onClick={() => setCollapsed(prev => !prev)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10 hidden md:flex"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:block h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}