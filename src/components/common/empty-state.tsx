import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        className,
      )}
    >
      {Icon ? <Icon className="size-8 text-muted-foreground" aria-hidden /> : null}
      <div>
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
