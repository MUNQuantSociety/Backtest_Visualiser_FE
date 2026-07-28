import type { BacktestFilters } from '../types/backtest';

/**
 * Hierarchical query keys. The nesting is what makes partial invalidation work:
 * `invalidateQueries({ queryKey: backtestKeys.lists() })` refreshes every list
 * regardless of filters, while leaving cached detail pages untouched.
 */
export const backtestKeys = {
  all: ['backtests'] as const,
  lists: () => [...backtestKeys.all, 'list'] as const,
  list: (filters: BacktestFilters) => [...backtestKeys.lists(), filters] as const,
  details: () => [...backtestKeys.all, 'detail'] as const,
  detail: (id: string) => [...backtestKeys.details(), id] as const,
  trades: (id: string) => [...backtestKeys.detail(id), 'trades'] as const,
} as const;
