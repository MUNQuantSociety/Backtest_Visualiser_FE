/**
 * Public surface of the live portfolios feature (MQS Master).
 *
 * Everything outside `src/features/portfolios/` imports from here and nowhere
 * else — ESLint's `no-restricted-imports` rule blocks `@/features/portfolios/*`
 * deep paths. That keeps internals free to move without a repo-wide refactor.
 */

export { ConfigPanel } from './components/config-panel';
export { CorrelationMatrix } from './components/correlation-matrix';
export { EngineStateBadge } from './components/engine-state-badge';
export { ExecutionLogTable } from './components/execution-log-table';
export { PortfolioCard } from './components/portfolio-card';
export { PortfolioList } from './components/portfolio-list';
export { PortfolioSummary } from './components/portfolio-summary';
export { PortfolioSwitcher } from './components/portfolio-switcher';
export { PositionsTable } from './components/positions-table';
export {
  usePortfolio,
  usePortfolioCorrelations,
  usePortfolioEquity,
  usePortfolioExecutions,
  usePortfolios,
  usePortfolioTotals,
  type PortfolioTotals,
} from './hooks/use-portfolios';
export { portfolioKeys } from './api/query-keys';
export type {
  CorrelationMatrix as CorrelationMatrixData,
  EngineState,
  EquitySamplePoint,
  Execution,
  ExecutionFilters,
  OmsConfig,
  PortfolioConfig,
  PortfolioDetail,
  PortfolioSummary as PortfolioSummaryData,
  Position,
} from './types/portfolio';
