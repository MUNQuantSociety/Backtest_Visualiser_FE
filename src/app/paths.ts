export const paths = {
  dashboard: '/',
  backtests: '/backtests',
  backtestDetail: (id: string) => `/backtests/${id}`,
  strategies: '/strategies',
  compare: '/compare',

  /* MQS Master — the live trading system. */
  live: '/live',
  portfolios: '/live/portfolios',
  portfolioDetail: (id: string) => `/live/portfolios/${id}`,
  log: '/live/log',
  settings: '/live/settings',
} as const;
