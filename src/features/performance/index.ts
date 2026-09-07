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
/*
 * Singular `metric-`, not `metrics-`, and the mismatch with the component name
 * is deliberate. Mainstream content blockers refuse a script whose path looks
 * like an analytics endpoint, and these two filenames matched. In dev, where
 * Vite serves every module as its own request, that killed the entire feature:
 * each page importing this barrel died on `Failed to fetch dynamically
 * imported module` and rendered a blank error screen.
 *
 * It was expensive to find because nothing in the repo was wrong. The dev
 * server answered 200 — `curl` with the browser's own headers proves it — and
 * the browser discarded the response, so there was no server-side error to
 * read. Typecheck, lint and tests all passed. A production build folds both
 * files into one hashed chunk, so the name never reaches the wire and the
 * symptom never appears outside dev.
 *
 * Renaming these back to match `MetricsGrid` / `MetricsTable` reintroduces it.
 */
export { MetricsGrid } from './metric-grid';
export { MetricsTable } from './metric-table';
export { ComparisonChart, type ComparisonSeries } from './comparison-chart';
export { DrawdownOverlay } from './drawdown-overlay';
export { MonthlyDifferenceHeatmap } from './monthly-difference-heatmap';
export { RollingSharpeOverlay } from './rolling-sharpe-overlay';
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
