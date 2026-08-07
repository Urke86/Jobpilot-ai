import { useState } from 'react';
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
import { useTheme } from '@/contexts';
import Sidebar, {
  AiInsightsCard,
  BrandMark,
  SidebarNav,
} from '@/layouts/Sidebar';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-64 flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <BrandMark />
          <div className="flex-1 p-4">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="p-4">
            <AiInsightsCard />
          </div>
        </SheetContent>
      </Sheet>

      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-4 border-b bg-card px-4 lg:pl-64">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search jobs, companies..."
            className={cn(
              'h-9 w-full rounded-lg border-none bg-muted py-2 pl-9 pr-14 text-sm text-foreground outline-none',
              'placeholder:text-muted-foreground',
              'focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
              'transition-colors duration-150',
            )}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Avatar className="ml-1 h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-blue-600 text-xs font-medium text-white">
              JP
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="pt-14 lg:pl-64">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
