import { NavLink } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  Compass,
  LayoutDashboard,
  Briefcase,
  Send,
  Building2,
  Bot,
  Inbox,
  Settings,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { APP_NAME } from '@/constants';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: ROUTES.jobs, label: 'Jobs', icon: Briefcase },
  { to: ROUTES.applications, label: 'Applications', icon: Send },
  { to: ROUTES.companies, label: 'Companies', icon: Building2 },
  { to: ROUTES.hiringInbox, label: 'Hiring Inbox', icon: Inbox },
  { to: ROUTES.assistant, label: 'AI Assistant', icon: Bot },
  { to: ROUTES.settings, label: 'Settings', icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'border-l-2 border-blue-500 bg-accent text-accent-foreground'
                : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
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

export function BrandMark() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b px-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
        <Compass className="h-4 w-4" />
      </div>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        {APP_NAME}
      </span>
    </div>
  );
}

export function AiInsightsCard() {
  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
        </div>
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          Data secured
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Your jobs, applications, and hiring inbox sync to Supabase with
        privacy-conscious Google integration.
      </p>
      <NavLink
        to={ROUTES.assistant}
        className="mt-2.5 inline-block text-xs font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Open Assistant →
      </NavLink>
    </div>
  );
}

export default function Sidebar({
  onSignOut,
}: {
  onSignOut?: () => void | Promise<void>;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
      <BrandMark />
      <div className="flex-1 overflow-y-auto p-4">
        <SidebarNav />
      </div>
      <div className="space-y-3 p-4">
        <AiInsightsCard />
        {onSignOut ? (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => void onSignOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
