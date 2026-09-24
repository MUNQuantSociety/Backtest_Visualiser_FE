export const paths = {
  dashboard: '/',
  /** Strategies and their runs share the Backtests hub. */
  backtests: '/backtests',
  library: '/backtests',
  libraryStrategy: (id: string) => `/backtests?strategy=${encodeURIComponent(id)}`,
  backtestDetail: (id: string) => `/backtests/${id}`,
  compare: '/compare',
  tickerDetail: (ticker: string) => `/tickers/${encodeURIComponent(ticker)}`,
  /* MQS Master — the live trading system. */
  live: '/live',
  portfolios: '/live/portfolios',
  portfolioDetail: (id: string) => `/live/portfolios/${id}`,
  log: '/live/log',
  settings: '/live/settings',
  /* Tools */
  stockScreener: '/tools/screener',
  financialCalculator: '/tools/calculator',

  /* Auth */
  login: '/auth/login',
  authCallback: '/auth/callback',
  register: '/auth/register',
} as const;
