import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import Sidebar, { SidebarNav } from './Sidebar';
import { Compass, Sparkles } from 'lucide-react';

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (stored === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  return { isDark, toggle } as const;
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>

          {/* Logo */}
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              JobPilot AI
            </span>
          </div>

          {/* Nav */}
          <div className="flex-1 p-4" onClick={() => setMobileOpen(false)}>
            <SidebarNav />
          </div>

          {/* AI Card */}
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
        </SheetContent>
      </Sheet>

      {/* Top Bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-4 border-b bg-card px-4 lg:pl-64">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search jobs, companies..."
            className={cn(
              'h-9 w-full rounded-lg border-none bg-muted py-2 pl-9 pr-14 text-sm text-foreground outline-none',
              'placeholder:text-muted-foreground',
              'focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
              'transition-colors duration-150'
            )}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500" />
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* User avatar */}
          <Avatar className="ml-1 h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-blue-600 text-xs font-medium text-white">
              JP
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 lg:pl-64">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
