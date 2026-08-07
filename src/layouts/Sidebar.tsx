import { NavLink } from 'react-router-dom';
import {
  Compass,
  LayoutDashboard,
  Briefcase,
  Send,
  Building2,
  Bot,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/applications', label: 'Applications', icon: Send },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'border-l-2 border-blue-500 bg-accent text-accent-foreground'
                : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Compass className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          JobPilot AI
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <SidebarNav />
      </div>

      {/* AI Insights Card */}
      <div className="p-4">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              AI Analysis Ready
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            New insights available based on your recent activity.
          </p>
          <button
            type="button"
            className="mt-2.5 text-xs font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Insights →
          </button>
        </div>
      </div>
    </aside>
  );
}
