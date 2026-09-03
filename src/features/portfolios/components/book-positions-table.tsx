import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { BookPosition } from '../live-book';

const GRID = '56px 22px 60px 66px 66px 84px 58px minmax(0,1fr) minmax(0,1fr)';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

interface BookPositionsTableProps {
  positions: readonly BookPosition[];
  isLoading?: boolean | undefined;
}

/** Positions across every sleeve, largest |weight| first. */
export function BookPositionsTable({ positions, isLoading = false }: BookPositionsTableProps) {
  if (isLoading && positions.length === 0) return <Skeleton className="h-56" />;
  if (positions.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">The book is flat.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div
          className="grid gap-3 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Ticker</span>
          <span />
          <span className="text-right">Qty</span>
          <span className="text-right">Avg</span>
          <span className="text-right">Last</span>
          <span className="text-right">Unreal</span>
          <span className="text-right">Weight</span>
          <span>Sector</span>
          <span>Sleeve</span>
        </div>
        {positions.map((position) => (
          <div
            key={`${position.sleeveId}-${position.ticker}`}
            className="grid items-center gap-3 border-b py-2 text-xs last:border-b-0"
            style={{ gridTemplateColumns: GRID }}
          >
            <span className="tabular font-medium">{position.ticker}</span>
            <span className="text-[10px] text-muted-foreground uppercase">
              {position.side === 'short' ? 'S' : 'L'}
            </span>
            <span className="tabular text-right">{formatNumber(position.quantity, 0)}</span>
            <span className="tabular text-right text-muted-foreground">
              {formatNumber(position.avgPrice, 2)}
            </span>
            <span className="tabular text-right">{formatNumber(position.lastPrice, 2)}</span>
            <span
              className={cn('tabular text-right', toneClass[toneFromValue(position.unrealizedPnl)])}
            >
              {formatSigned(position.unrealizedPnl, (n) => formatCurrency(n))}
            </span>
            <span className="tabular text-right">{formatPercent(position.weight, 1)}</span>
            <span className="truncate text-muted-foreground">{position.sector}</span>
            <Link
              to={paths.portfolioDetail(position.sleeveId)}
              className="truncate text-muted-foreground hover:text-foreground hover:underline"
            >
              {position.sleeve}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
