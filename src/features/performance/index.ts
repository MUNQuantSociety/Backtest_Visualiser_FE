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
export { buildTearsheet } from './tearsheet';
export type { TearsheetRow, TearsheetSection } from './tearsheet';
