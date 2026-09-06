export const paths = {
  dashboard: '/',
  /** Strategies and their runs, one page. Replaced /strategies and /backtests. */
  library: '/library',
  libraryStrategy: (id: string) => `/library?strategy=${encodeURIComponent(id)}`,
  backtestDetail: (id: string) => `/backtests/${id}`,
  compare: '/compare',
  /* MQS Master — the live trading system. */
  live: '/live',
  portfolios: '/live/portfolios',
  portfolioDetail: (id: string) => `/live/portfolios/${id}`,
  log: '/live/log',
  settings: '/live/settings',

  /* Auth */
  login: '/auth/login',
  register: '/auth/register',
} as const;
