import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { seriesColor } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';
import { formatNumber, formatRelativeDay } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

import { strategyColorIndex, type StrategyFilter } from '../strategy-filter';
import type { Strategy, StrategyStatus } from '../types';

import { StrategyActions } from './strategy-actions';

interface StrategyPickerProps {
  strategies: readonly Strategy[] | undefined;
  isLoading: boolean;
  filter: StrategyFilter;
  onFilterChange: (filter: StrategyFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Runs in flight per strategy, for the "1 running" status line. */
  runningCount: (strategyId: string) => number;
  /** Opens the editor on a saved strategy. Omit to hide the actions menu. */
  onEdit?: ((strategy: Strategy) => void) | undefined;
  /** Opens the run dialog with this strategy preselected. */
  onRun?: ((strategy: Strategy) => void) | undefined;
}

/** The left column of the Library: every strategy, one selected. */
export function StrategyPicker({
  strategies,
  isLoading,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  runningCount,
  onEdit,
  onRun,
}: StrategyPickerProps) {
  const palette = useChartPalette();
  const all = strategies ?? [];
  const count = (status: StrategyStatus) => all.filter((s) => s.status === status).length;

  const options = [
    { value: 'all', label: `All ${String(all.length)}` },
    { value: 'active', label: `Active ${String(count('active'))}` },
    { value: 'draft', label: `Draft ${String(count('draft'))}` },
    { value: 'archived', label: `Archived ${String(count('archived'))}` },
  ] as const satisfies readonly { value: StrategyFilter; label: string }[];

  const shown = all.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div className="space-y-3">
      <Segmented
        value={filter}
        options={options}
        onChange={onFilterChange}
        ariaLabel="Filter strategies"
      />

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 5 }, (_unused, index) => (
            <Skeleton key={index} className="h-[88px]" />
          ))}
        </div>
      ) : (
        <div role="listbox" aria-label="Strategies" className="space-y-1.5">
          {shown.map((strategy) => {
            const selected = strategy.id === selectedId;
            const colorIndex = strategyColorIndex(strategy, all);
            const running = runningCount(strategy.id);

            if (strategy.status === 'archived') {
              return (
                <button
                  key={strategy.id}
                  data-slot="card"
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(strategy.id);
                  }}
                  className={cn(
                    'flex w-full max-w-full min-w-0 flex-wrap items-center justify-between overflow-hidden rounded-md border px-3.5 py-2 text-left text-[13px] [overflow-wrap:anywhere] text-muted-foreground transition-colors',
                    selected
                      ? 'border-primary shadow-[inset_3px_0_0_var(--primary)]'
                      : 'hover:bg-muted/60',
                  )}
                >
                  <span className="truncate">{strategy.name}</span>
                  <span className="tabular shrink-0 text-[11px]">
                    archived · {String(strategy.runCount)} runs
                  </span>
                </button>
              );
            }

            const draft = strategy.status === 'draft';
            const actions =
              onEdit && onRun ? (
                // A sibling of the card, never a child: the card is itself a
                // button, and a button inside a button is invalid and
                // swallows the click.
                <div className="absolute top-2.5 right-2.5 z-10">
                  <StrategyActions strategy={strategy} onEdit={onEdit} onRun={onRun} />
                </div>
              ) : null;
            return (
              <div key={strategy.id} className="relative">
                <button
                  data-slot="card"
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(strategy.id);
                  }}
                  className={cn(
                    // `pr-9` reserves the top-right corner for the actions menu, which is
                    // positioned over the card rather than laid out inside it.
                    'w-full max-w-full min-w-0 overflow-hidden rounded-md border py-3 pr-9 pl-3.5 text-left [overflow-wrap:anywhere] transition-colors',
                    draft && 'border-dashed border-[var(--border-strong)]',
                    selected
                      ? 'border-primary shadow-[inset_3px_0_0_var(--primary)]'
                      : 'hover:bg-muted/60',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{
                        background:
                          colorIndex === null
                            ? 'var(--border-strong)'
                            : seriesColor(palette, colorIndex),
                      }}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm font-medium',
                        draft && 'text-muted-foreground',
                      )}
                    >
                      {strategy.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          background: draft
                            ? 'var(--warning)'
                            : running > 0
                              ? 'var(--warning)'
                              : 'var(--profit)',
                        }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          draft || running > 0 ? 'text-[var(--warning)]' : 'text-muted-foreground',
                        )}
                      >
                        {draft ? 'draft' : running > 0 ? `${String(running)} running` : 'active'}
                      </span>
                    </span>
                  </div>
                  <p className="tabular mt-1 truncate text-[11px] text-muted-foreground">
                    {strategy.universe.join(' · ')}
                    {draft ? ' — not yet runnable' : ''}
                  </p>
                  {!draft ? (
                    <dl className="tabular mt-2.5 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-[9px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Runs
                        </dt>
                        <dd>{formatNumber(strategy.runCount, 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Best Sharpe
                        </dt>
                        <dd>
                          {strategy.bestSharpe === null ? '—' : formatNumber(strategy.bestSharpe)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Last run
                        </dt>
                        <dd>{strategy.lastRunAt ? formatRelativeDay(strategy.lastRunAt) : '—'}</dd>
                      </div>
                    </dl>
                  ) : null}
                </button>
                {actions}
              </div>
            );
          })}
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No strategies match.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
