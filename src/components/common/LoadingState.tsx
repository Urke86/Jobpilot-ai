import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({
  label = 'Loading…',
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
