import { CircleX, Info, Loader2, Timer } from 'lucide-react';

import { cn } from '@/lib/utils';

import { isInFlight, type BacktestDetail, type BacktestSummary } from './types';

/**
 * Explains progress, failures and completed runs with no recorded fills.
 *
 * Everything else on the detail page assumes a finished backtest: metrics,
 * curve, trades. For a queued, running or failed run all of those are empty,
 * and without this the page is a wall of blank panels with no explanation.
 *
 * The backend has always sent `progressPct` and `errorMessage`. Nothing read
 * them, which is why a queued run looked identical to a broken one.
 */
export function RunStatusBanner({ run }: { run: BacktestDetail | BacktestSummary }) {
  if (run.status === 'completed') {
    const execution = 'reportMetadata' in run ? run.reportMetadata?.execution : undefined;
    if (execution?.fillCount !== 0 || !execution.message?.trim()) return null;

    // The backend distinguishes missing signals from unfilled orders and fast
    // mode, where an empty trade list does not imply the strategy stayed in cash.
    return (
      <div role="status" className="flex items-start gap-2.5 rounded-md border p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Run completed</p>
          <p className="text-sm break-words text-muted-foreground">{execution.message}</p>
        </div>
      </div>
    );
  }

  const failed = run.status === 'failed';

  if (!failed && !isInFlight(run.status)) return null;

  // `progressPct` and `errorMessage` only exist on the detail payload; the list
  // rows are the same shape minus those two fields.
  const progress = 'progressPct' in run ? run.progressPct : null;
  const message = 'errorMessage' in run ? run.errorMessage : null;

  if (failed) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-md border border-[var(--loss)]/40 p-3"
      >
        <CircleX className="mt-0.5 size-4 shrink-0 text-[var(--loss)]" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-[var(--loss)]">This run failed</p>
          <p className="text-sm break-words text-muted-foreground">
            {/* A failure with no recorded reason is itself worth saying, rather
                than rendering an empty line that reads as a UI bug. */}
            {message ?? 'No reason was recorded. The worker may have been interrupted.'}
          </p>
        </div>
      </div>
    );
  }

  const running = run.status === 'running';
  const Icon = running ? Loader2 : Timer;

  return (
    <div role="status" className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2.5">
        <Icon
          className={cn('size-4 shrink-0 text-muted-foreground', running && 'animate-spin')}
          aria-hidden
        />
        <p className="text-sm font-medium">
          {running ? 'Running' : 'Queued'}
          {progress !== null ? (
            <span className="tabular ml-1.5 font-normal text-muted-foreground">
              {Math.round(progress)}%
            </span>
          ) : null}
        </p>
      </div>

      {progress !== null ? (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Backtest progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-accent"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${String(Math.max(0, Math.min(100, progress)))}%` }}
          />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Results appear here once the run finishes. This page updates on its own.
      </p>
    </div>
  );
}
