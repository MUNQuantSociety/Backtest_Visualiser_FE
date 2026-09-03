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
  alignByDate,
  alphaRows,
  benchmarkCurve,
  bestRunByStrategy,
  bookCurve,
  regressOnBenchmark,
  returnCorrelation,
  sliceToPeriod,
  summariseBook,
  universeRows,
  type AlphaRow,
  type BookStrategy,
  type BookSummary,
  type UniverseRow,
} from './book';
export {
  chipParts,
  chipSummary,
  compareContext,
  compareMetricRows,
  defaultComparison,
  deltaTone,
  describeComparison,
  parameterRows,
  winnerIndex,
  type ChipPart,
  type CompareMetricRow,
  type ParameterRow,
} from './compare-model';
export { RecentRunsTable } from './recent-runs-table';
export { RunPickerDialog } from './run-picker-dialog';
export {
  isPageSize,
  isRunSort,
  isStatusFilter,
  monthSpan,
  PAGE_SIZES,
  RUN_SORTS,
  viewRuns,
  type PageSize,
  type RunSort,
  type StatusFilter,
} from './run-filters';
export { RunsTable } from './runs-table';
export { RunBacktestDialog } from './run-backtest-dialog';
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
