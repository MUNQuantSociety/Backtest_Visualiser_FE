/**
 * Public surface of the backtests feature.
 *
 * Everything outside `src/features/backtests/` imports from here and nowhere
 * else — ESLint's `no-restricted-imports` rule blocks `@/features/backtests/*`
 * deep paths. That keeps internals free to move without a repo-wide refactor.
 */

export { BacktestCard } from './backtest-card';
export { BacktestList } from './backtest-list';
export {
    fetchBacktests,
    useBacktest,
    useBacktestDetails,
    useBacktests,
    useDeleteBacktest,
} from './backtests-api';
export { backtestKeys } from './backtests-api';
export type {
    BacktestDetail,
    BacktestFilters,
    BacktestStatus,
    BacktestSummary,
    EquityPoint,
    PerformanceMetrics,
    Trade,
} from './types';
