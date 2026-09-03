import { Plus, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatRelativeDay, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { useBacktests } from './backtests-api';
import { monthSpan } from './run-filters';

interface RunPickerDialogProps {
  /** Runs already in the comparison; shown but not addable again. */
  excludeIds: readonly string[];
  onPick: (id: string) => void;
  disabled?: boolean | undefined;
  label?: string | undefined;
}

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/**
 * "+ Add run": search over every run, newest first, pick one.
 *
 * Same native-dialog construction as the run dialog. The list is mounted only
 * while open, so the Compare page does not hold the whole run list in memory
 * for a control most visits never touch.
 */
export function RunPickerDialog({
  excludeIds,
  onPick,
  disabled = false,
  label = '+ Add run',
}: RunPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setOpen(true);
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <Button size="sm" onClick={openDialog} disabled={disabled}>
        <Plus className="mr-1.5 size-4" aria-hidden />
        {label.replace(/^\+\s*/, '')}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="run-picker-title"
        onClose={() => {
          setOpen(false);
        }}
        onClick={(event) => {
          const dialog = dialogRef.current;
          if (!dialog || event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          const inside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
          if (!inside) closeDialog();
        }}
        className="m-auto max-h-[calc(100vh-2rem)] w-[min(640px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/85"
      >
        <div className="sticky top-0 z-10 space-y-3 border-b bg-card px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            <h2 id="run-picker-title" className="text-[15px] font-semibold tracking-tight">
              Add a run
            </h2>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={closeDialog}>
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search runs"
              aria-label="Search runs"
              autoFocus
              className="h-8 w-full rounded-md border border-input bg-background pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        {open ? (
          <RunList
            query={query}
            excludeIds={excludeIds}
            onPick={(id) => {
              onPick(id);
              closeDialog();
            }}
          />
        ) : null}
      </dialog>
    </>
  );
}

function RunList({
  query,
  excludeIds,
  onPick,
}: {
  query: string;
  excludeIds: readonly string[];
  onPick: (id: string) => void;
}) {
  const runs = useBacktests({ pageSize: 100 });
  if (runs.isPending) {
    return (
      <div className="space-y-2 p-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }
  const needle = query.trim().toLowerCase();
  const items = (runs.data?.items ?? [])
    .filter((run) => run.status === 'completed')
    .filter(
      (run) =>
        !needle || `${run.name} ${run.strategyName} ${run.symbol}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (items.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">No completed runs match.</p>
    );
  }

  return (
    <ul className="p-2">
      {items.map((run) => {
        const already = excludeIds.includes(run.id);
        return (
          <li key={run.id}>
            <button
              type="button"
              disabled={already}
              onClick={() => {
                onPick(run.id);
              }}
              className={cn(
                'grid w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs transition-colors',
                already ? 'opacity-40' : 'hover:bg-muted/60',
              )}
              style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 64px 56px' }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{run.name}</span>
                <span className="tabular block truncate text-[11px] text-muted-foreground">
                  {run.strategyName} · {run.symbol} · {monthSpan(run.startDate, run.endDate)}
                </span>
              </span>
              <span className="tabular text-right text-muted-foreground">
                {formatRelativeDay(run.createdAt)}
              </span>
              <span className={cn('tabular text-right', toneClass[toneFromValue(run.totalReturn)])}>
                {formatSigned(run.totalReturn, (n) => formatPercent(n, 1))}
              </span>
              <span className="tabular text-right">{formatNumber(run.sharpe)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
