import type { ExecutionFilters } from './types';

/**
 * Hierarchical query keys for the live portfolios feature.
 *
 * Namespaced under `live-portfolios` rather than `portfolios` so nothing here
 * can collide with a future backtest-side portfolio concept — cache keys are a
 * global namespace, and a silent collision serves one product's data to the
 * other.
 */
export const portfolioKeys = {
  all: ['live-portfolios'] as const,
  lists: () => [...portfolioKeys.all, 'list'] as const,
  list: () => [...portfolioKeys.lists(), {}] as const,
  details: () => [...portfolioKeys.all, 'detail'] as const,
  detail: (id: string) => [...portfolioKeys.details(), id] as const,
  equity: (id: string, days: number) => [...portfolioKeys.detail(id), 'equity', days] as const,
  executions: (id: string, filters: ExecutionFilters) =>
    [...portfolioKeys.detail(id), 'executions', filters] as const,
  correlations: (id: string) => [...portfolioKeys.detail(id), 'correlations'] as const,
} as const;
