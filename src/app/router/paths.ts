/**
 * Single source of truth for URLs. Building links through these functions means
 * a route rename is one edit here, not a repo-wide search for string literals.
 */
export const paths = {
  dashboard: '/',
  backtests: '/backtests',
  backtestDetail: (id: string) => `/backtests/${encodeURIComponent(id)}`,
  strategies: '/strategies',
  compare: '/compare',
} as const;

/** Route patterns as react-router expects them (with `:params`). */
export const routePatterns = {
  dashboard: '/',
  backtests: '/backtests',
  backtestDetail: '/backtests/:backtestId',
  strategies: '/strategies',
  compare: '/compare',
} as const;
