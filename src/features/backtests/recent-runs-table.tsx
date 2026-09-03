import { Link } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { BacktestStatus, BacktestSummary } from './types';

const COLUMNS = '1.6fr 1fr 1fr 1.1fr 80px 70px 80px 110px';

const STATUS_DOT: Record<BacktestStatus, string> = {
  completed: 'var(--profit)',
  running: 'var(--warning)',
  queued: 'var(--warning)',
  failed: 'var(--loss)',
};

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/** `2023-01-03` → `2023-01`: month precision is all a window column needs. */
const month = (iso: string) => iso.slice(0, 7);

export function RecentRunsTable({
  runs,
  isLoading,
}: {
  runs: readonly BacktestSummary[];
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-48" />;
  if (runs.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No runs yet.</p>;
  }

  return (
    <div className="min-w-[760px]">
      <div
        className="tabular grid gap-2 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
        style={{ gridTemplateColumns: COLUMNS }}
      >
        <span>Run</span>
        <span>Strategy</span>
        <span>Universe</span>
        <span>Window</span>
        <span className="text-right">Return</span>
        <span className="text-right">Sharpe</span>
        <span className="text-right">Max DD</span>
        <span>Status</span>
      </div>
      {runs.map((run) => (
        <Link
          key={run.id}
          to={`/backtests/${run.id}`}
          className="grid items-center gap-2 border-b py-2 text-xs last:border-b-0 hover:bg-muted/60"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span className="truncate font-medium">{run.name}</span>
          <span className="truncate text-muted-foreground">{run.strategyName}</span>
          <span className="tabular truncate">{run.symbol}</span>
          <span className="tabular truncate text-muted-foreground">
            {month(run.startDate)} → {month(run.endDate)}
          </span>
          <span className={cn('tabular text-right', toneClass[toneFromValue(run.totalReturn)])}>
            {formatSigned(run.totalReturn, (n) => formatPercent(n, 1))}
          </span>
          <span className="tabular text-right">{formatNumber(run.sharpe)}</span>
          <span className="tabular text-right text-[var(--loss)]">
            {formatPercent(run.maxDrawdown, 1)}
          </span>
          <span className="flex items-center gap-1.5 capitalize">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: STATUS_DOT[run.status] }}
              aria-hidden
            />
            {run.status}
          </span>
        </Link>
      ))}
    </div>
  );
}
