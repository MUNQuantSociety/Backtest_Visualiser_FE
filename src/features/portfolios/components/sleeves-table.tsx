import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Sparkline } from '@/components/charts/sparkline';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompact, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { SleeveRow } from '../live-book';

const GRID = 'minmax(0,1fr) 68px 64px 56px 40px 68px';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

const stateClass: Record<SleeveRow['state'], string | undefined> = {
  running: 'text-[var(--profit)]',
  stopped: undefined,
  halted: 'text-[var(--loss)]',
  error: 'text-[var(--loss)]',
};

interface SleevesTableProps {
  rows: readonly SleeveRow[];
  isLoading?: boolean | undefined;
}

/** One row per live portfolio; the sparkline is the last 60 sessions. */
export function SleevesTable({ rows, isLoading = false }: SleevesTableProps) {
  if (isLoading && rows.length === 0) return <Skeleton className="h-48" />;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[440px]">
        <div
          className="grid gap-3 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Sleeve</span>
          <span className="text-right">NAV</span>
          <span className="text-right">Day</span>
          <span className="text-right">MTD</span>
          <span className="text-right">SR</span>
          <span className="text-right">60d</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid items-center gap-3 border-b py-2 text-xs last:border-b-0"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="min-w-0">
              <Link
                to={paths.portfolioDetail(row.id)}
                className="block truncate text-sm font-medium hover:underline"
              >
                {row.name}
              </Link>
              <p className="tabular truncate text-[11px] text-muted-foreground">
                <span className={stateClass[row.state]}>{row.state}</span>
                {' · '}
                {formatPercent(row.weight, 0)}
                {' · gross '}
                {formatNumber(row.gross, 2)}
              </p>
            </div>
            <span className="tabular text-right">${formatCompact(row.nav)}</span>
            <span className={cn('tabular text-right', toneClass[toneFromValue(row.day)])}>
              {formatSigned(row.day, (n) => `$${formatCompact(n)}`)}
            </span>
            <span className={cn('tabular text-right', toneClass[toneFromValue(row.mtd)])}>
              {formatSigned(row.mtd, (n) => formatPercent(n, 1))}
            </span>
            <span className="tabular text-right">{formatNumber(row.sharpe60, 2)}</span>
            <span className="flex justify-end">
              <Sparkline values={row.spark} width={64} height={22} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
