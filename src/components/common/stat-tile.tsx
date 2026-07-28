import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Tone } from '@/utils/tone';

/* `| undefined` on every optional prop is required by `exactOptionalPropertyTypes`.
   It lets callers pass a possibly-undefined expression without a cast, while
   still rejecting a missing *required* prop. */
interface StatTileProps {
  label: string;
  value: string;
  /** Drives the accent colour: gains green, losses red, otherwise inherit. */
  tone?: Tone | undefined;
  hint?: string | undefined;
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

const toneClass: Record<Tone, string> = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
};

export function StatTile({
  label,
  value,
  tone = 'neutral',
  hint,
  isLoading = false,
  className,
}: StatTileProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4 pt-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className={cn('tabular mt-1 text-2xl font-semibold', toneClass[tone])}>{value}</p>
        )}
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
