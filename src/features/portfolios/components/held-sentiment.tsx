import { Skeleton } from '@/components/ui/skeleton';
import { DivergingBar } from '@/features/market';
import { cn } from '@/lib/utils';
import { formatNumber, formatSigned } from '@/utils/format';

import type { HeldRow } from '../live-book';

const GRID = '56px 52px minmax(0,1fr) 44px';

interface HeldSentimentProps {
  rows: readonly HeldRow[];
  isLoading?: boolean | undefined;
}

/**
 * 7-day article score per held name. Rows arrive sorted worst-first: a red
 * score on a long, or a green one on a short, is the position the news argues
 * against, and that is what to look at first.
 */
export function HeldSentiment({ rows, isLoading = false }: HeldSentimentProps) {
  if (isLoading && rows.length === 0) return <Skeleton className="h-48" />;
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No indicator coverage for the names held.
      </p>
    );
  }

  return (
    <div>
      {rows.map((row) => {
        const against = row.side === 'long' ? row.sentiment7d < -0.2 : row.sentiment7d > 0.2;
        return (
          <div
            key={row.ticker}
            className="grid items-center gap-3 border-b py-1.5 text-xs last:border-b-0"
            style={{ gridTemplateColumns: GRID }}
          >
            <span className="tabular font-medium">
              {row.ticker}
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground uppercase">
                {row.side === 'short' ? 'S' : 'L'}
              </span>
            </span>
            <span className="tabular text-muted-foreground">RSI {formatNumber(row.rsi14, 0)}</span>
            <DivergingBar value={row.sentiment7d} width={112} />
            <span
              className={cn(
                'tabular text-right',
                against ? 'font-semibold' : undefined,
                row.sentiment7d < 0 ? 'text-[var(--loss)]' : 'text-[var(--profit)]',
              )}
            >
              {formatSigned(row.sentiment7d, (n) => n.toFixed(2))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
