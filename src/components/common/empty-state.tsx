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
            {Icon ? <Icon className="text-muted-foreground size-8" aria-hidden /> : null}
            <div>
                <p className="font-medium">{title}</p>
                {description ? (
                    <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>
                ) : null}
            </div>
            {action}
        </div>
    );
}
