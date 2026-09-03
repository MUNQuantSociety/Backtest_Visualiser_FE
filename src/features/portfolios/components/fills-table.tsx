import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/utils/format';

import type { FillRow } from '../live-book';

const GRID = '64px 52px 44px 52px 64px minmax(0,1fr) 72px';

/** Exchange time, since that is the clock the engine and the log run on. */
const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface FillsTableProps {
  fills: readonly FillRow[];
  isLoading?: boolean | undefined;
}

/** Today's fills across the sleeves, newest first. */
export function FillsTable({ fills, isLoading = false }: FillsTableProps) {
  if (isLoading && fills.length === 0) return <Skeleton className="h-40" />;
  if (fills.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No fills yet today.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div
          className="grid gap-3 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Time</span>
          <span>Ticker</span>
          <span>Side</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Price</span>
          <span>Sleeve</span>
          <span>Reason</span>
        </div>
        {fills.map((fill) => (
          <div
            key={fill.id}
            className="grid items-center gap-3 border-b py-2 text-xs last:border-b-0"
            style={{ gridTemplateColumns: GRID }}
          >
            <span className="tabular text-muted-foreground">
              {timeFormat.format(new Date(fill.time))}
            </span>
            <span className="tabular font-medium">{fill.ticker}</span>
            <span className="tabular text-[11px]">{fill.side}</span>
            <span className="tabular text-right">{formatNumber(fill.quantity, 0)}</span>
            <span className="tabular text-right">{formatNumber(fill.price, 2)}</span>
            <Link
              to={paths.portfolioDetail(fill.sleeveId)}
              className="truncate text-muted-foreground hover:text-foreground hover:underline"
            >
              {fill.sleeve}
            </Link>
            <span className="truncate text-muted-foreground">{fill.reason ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
