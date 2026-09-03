/**
 * Public surface of the performance feature.
 *
 * Restored after the file-hierarchy move deleted it: without a barrel, pages
 * were reaching in with `../features/performance/<file>`, which slips past the
 * `no-restricted-imports` guard — that pattern matches the aliased deep import,
 * not a single-level relative path — and quietly contradicted the rule
 * documented in src/README.md.
 */

export { DrawdownChart } from './drawdown-chart';
export { EquityCurveChart } from './equity-curve-chart';
export { MetricsGrid } from './metrics-grid';
export { MetricsTable } from './metrics-table';
export { ComparisonChart, type ComparisonSeries } from './comparison-chart';
export { ComparisonTable } from './comparison-table';
export { PnlHistogram } from './pnl-histogram';
export { RiskReturnScatter } from './risk-return-scatter';
export { buildTearsheet } from './tearsheet';
export type { TearsheetRow, TearsheetSection } from './tearsheet';

/* Analytics panels. Recharts rather than lightweight-charts across the board:
   every one is a categorical or derived view, not a price series, which is the
   split src/README.md already draws. */
export { BetaScatter } from './beta-scatter';
export { DailyPnlBars } from './daily-pnl-bars';
export { DrawdownTable } from './drawdown-table';
export { MonthlyReturnsHeatmap } from './monthly-returns-heatmap';
export { ReturnsDistribution } from './returns-distribution';
export { RollingSharpeChart } from './rolling-sharpe-chart';
export { RollingVolatilityChart } from './rolling-volatility-chart';
export { TradeDurationScatter } from './trade-duration-scatter';
