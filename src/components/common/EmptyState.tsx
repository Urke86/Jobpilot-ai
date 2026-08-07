import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <Button type="button" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
