/**
 * Single source of truth for URLs. Building links through these functions means
 * a route rename is one edit here, not a repo-wide search for string literals.
 *
 * Two products share this shell, so the URL space is split by prefix: backtest
 * exploration sits at the root, the MQS Master live dashboard under `/live`.
 * Neither can then quietly claim a path the other wanted, and a glance at a URL
 * says which product you are looking at — which matters when one shows
 * simulated numbers and the other shows real money.
 */
export const paths = {
  dashboard: '/',
  backtests: '/backtests',
  backtestDetail: (id: string) => `/backtests/${encodeURIComponent(id)}`,
  strategies: '/strategies',
  compare: '/compare',

  /* MQS Master — the live trading system. */
  live: '/live',
  portfolios: '/live/portfolios',
  portfolioDetail: (id: string) => `/live/portfolios/${encodeURIComponent(id)}`,
  log: '/live/log',
  settings: '/live/settings',
} as const;

/** Route patterns as react-router expects them (with `:params`). */
export const routePatterns = {
  dashboard: '/',
  backtests: '/backtests',
  backtestDetail: '/backtests/:backtestId',
  strategies: '/strategies',
  compare: '/compare',

  live: '/live',
  portfolios: '/live/portfolios',
  portfolioDetail: '/live/portfolios/:portfolioId',
  log: '/live/log',
  settings: '/live/settings',
} as const;
