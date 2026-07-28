/**
 * Public surface of the backtests feature.
 *
 * Everything outside `src/features/backtests/` imports from here and nowhere
 * else — ESLint's `no-restricted-imports` rule blocks `@/features/backtests/*`
 * deep paths. That keeps internals free to move without a repo-wide refactor.
 */

export { BacktestCard } from './components/backtest-card';
export { BacktestList } from './components/backtest-list';
export { useBacktest, useBacktests, useDeleteBacktest } from './hooks/use-backtests';
export { backtestKeys } from './api/query-keys';
export type {
  BacktestDetail,
  BacktestFilters,
  BacktestStatus,
  BacktestSummary,
  EquityPoint,
  PerformanceMetrics,
  Trade,
} from './types/backtest';
