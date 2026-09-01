/**
 * Public surface of the backtests feature.
 *
 * Everything outside `src/features/backtests/` imports from here and nowhere
 * else — ESLint's `no-restricted-imports` rule blocks `@/features/backtests/*`
 * deep paths. That keeps internals free to move without a repo-wide refactor.
 */

export { BacktestCard } from './backtest-card';
export { BacktestList } from './backtest-list';
export { RunBacktestForm } from './run-backtest-form';
export { RunStatusBanner } from './run-status';
export {
  fetchBacktests,
  fetchCoverage,
  submitBacktest,
  useBacktest,
  useBacktestDetails,
  useBacktests,
  useCoverage,
  useDeleteBacktest,
  useSubmitBacktest,
} from './backtests-api';
export { backtestKeys } from './backtests-api';
export { isInFlight } from './types';
export type {
  BacktestDetail,
  BacktestFilters,
  BacktestRunRequest,
  BacktestStatus,
  BacktestSummary,
  CoverageResponse,
  EquityPoint,
  PerformanceMetrics,
  Trade,
} from './types';
