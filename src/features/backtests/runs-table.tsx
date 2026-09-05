import { Check } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatRelativeDay, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { monthSpan } from './run-filters';
import type { BacktestStatus, BacktestSummary } from './types';

const COLUMNS = '36px minmax(0,1.35fr) 112px minmax(0,1fr) 60px 52px 60px 76px 52px';

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

interface RunsTableProps {
  runs: readonly BacktestSummary[];
  isLoading: boolean;
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}

/**
 * A strategy's runs as a grid, each with a checkbox that accumulates a
 * comparison set. Clicking anywhere else on the row opens the run.
 *
 * The SETUP column shows symbol and timeframe. The handoff wants the
 * parameter diff from defaults here, but parameters only travel on the run
 * detail, and fetching every row's detail to render a list is the fan-out the
 * rest of the app avoids. Once the list payload carries `parameters` the
 * column can show the diff.
 */
export function RunsTable({ runs, isLoading, selectedIds, onToggle }: RunsTableProps) {
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-64" />;
  if (runs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No runs match.</p>;
  }

  return (
    <div className="min-w-[820px]">
      <div
        className="tabular grid items-center gap-2 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
        style={{ gridTemplateColumns: COLUMNS }}
      >
        <span />
        <span>Run</span>
        <span>Window</span>
        <span>Setup</span>
        <span className="text-right">Return</span>
        <span className="text-right">Sharpe</span>
        <span className="text-right">Max DD</span>
        <span>Status</span>
        <span className="text-right">When</span>
      </div>
      {runs.map((run) => {
        const checked = selectedIds.includes(run.id);
        const inFlight = run.status === 'running' || run.status === 'queued';
        return (
          <div
            key={run.id}
            role="row"
            className={cn(
              'grid cursor-pointer items-center gap-2 border-b py-2 text-xs transition-colors last:border-b-0',
              checked ? 'bg-selected' : 'hover:bg-muted/60',
            )}
            style={{ gridTemplateColumns: COLUMNS }}
            onClick={() => {
              void navigate(`/backtests/${run.id}`);
            }}
          >
            <label
              className="flex items-center justify-center"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                aria-label={`Select ${run.name}`}
                onChange={() => {
                  onToggle(run.id);
                }}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex size-3.5 items-center justify-center rounded-[3px] border',
                  checked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-[var(--border-strong)]',
                )}
              >
                {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
            </label>
            <span className="truncate font-medium">{run.name}</span>
            <span className="tabular truncate text-muted-foreground">
              {monthSpan(run.startDate, run.endDate)}
            </span>
            <span className="tabular truncate text-muted-foreground">
              {run.symbol} · {run.timeframe}
            </span>
            <span className={cn('tabular text-right', toneClass[toneFromValue(run.totalReturn)])}>
              {formatSigned(run.totalReturn, (n) => formatPercent(n, 1))}
            </span>
            <span className="tabular text-right">{formatNumber(run.sharpe)}</span>
            <span className="tabular text-right text-[var(--loss)]">
              {formatPercent(run.maxDrawdown, 1)}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: STATUS_DOT[run.status] }}
                aria-hidden
              />
              <span className={cn('capitalize', inFlight && 'text-[var(--warning)]')}>
                {run.status}
              </span>
            </span>
            <span className="tabular text-right text-muted-foreground">
              {formatRelativeDay(run.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
