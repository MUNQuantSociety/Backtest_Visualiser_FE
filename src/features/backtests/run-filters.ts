import type { BacktestStatus, BacktestSummary } from './types';

/**
 * Sort, filter and page a strategy's runs on the client.
 *
 * The list endpoint filters by strategy, status and search, but has no sort.
 * A strategy has tens of runs, not thousands, so the page fetches them in one
 * go and orders them here — which also keeps "Sharpe" a real sort over all of
 * them rather than over whichever page happened to load.
 */

export type RunSort = 'newest' | 'sharpe' | 'return' | 'maxDrawdown';

export const RUN_SORTS: readonly { value: RunSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'sharpe', label: 'Sharpe' },
  { value: 'return', label: 'Return' },
  { value: 'maxDrawdown', label: 'Max DD' },
];

export type StatusFilter = 'any' | BacktestStatus;

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export function isRunSort(value: string | null): value is RunSort {
  return RUN_SORTS.some((sort) => sort.value === value);
}

export function isStatusFilter(value: string | null): value is StatusFilter {
  return (
    value === 'any' ||
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed'
  );
}

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}

function compare(a: BacktestSummary, b: BacktestSummary, sort: RunSort): number {
  switch (sort) {
    case 'newest':
      return b.createdAt.localeCompare(a.createdAt);
    case 'sharpe':
      return b.sharpe - a.sharpe;
    case 'return':
      return b.totalReturn - a.totalReturn;
    case 'maxDrawdown':
      // Shallowest first: a less negative drawdown is the better run.
      return b.maxDrawdown - a.maxDrawdown;
  }
}

export interface RunView {
  rows: BacktestSummary[];
  /** How many matched before paging. */
  total: number;
}

export function viewRuns(
  runs: readonly BacktestSummary[],
  options: { status: StatusFilter; search: string; sort: RunSort; pageSize: PageSize },
): RunView {
  const needle = options.search.trim().toLowerCase();
  const matched = runs.filter((run) => {
    if (options.status !== 'any' && run.status !== options.status) return false;
    if (needle && !`${run.name} ${run.symbol}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  // A stable copy: `sort` mutates, and the input may be React Query's cache.
  const ordered = [...matched].sort((a, b) => compare(a, b, options.sort));
  return { rows: ordered.slice(0, options.pageSize), total: matched.length };
}

/** `2023-01-03` → `2023-01`: month precision is all a window column needs. */
export function monthSpan(startDate: string, endDate: string): string {
  return `${startDate.slice(0, 7)} → ${endDate.slice(0, 7)}`;
}
