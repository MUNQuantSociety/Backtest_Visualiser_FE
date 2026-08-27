import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const badgeVariants = cva(
    'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground border-transparent',
                secondary: 'bg-secondary text-secondary-foreground border-transparent',
                destructive: 'bg-destructive text-destructive-foreground border-transparent',
                outline: 'text-foreground',
                profit: 'border-transparent bg-[var(--profit)]/15 text-[var(--profit)]',
                loss: 'border-transparent bg-[var(--loss)]/15 text-[var(--loss)]',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
