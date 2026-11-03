import { beforeEach, expect, it, vi } from 'vitest';

import type * as MarketModule from '@/features/market';
import type * as WatchlistModule from '@/features/watchlist';
import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';

import StockScreenerPage from './stock-screener-page';

const watchlist = vi.hoisted(() => ({
  current: { tickers: [] as string[], isEdited: false, isLoading: false, isUnavailable: false },
}));

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn() },
}));
// The watchlist's own tests cover where its tickers come from.
vi.mock('@/features/watchlist', async (importOriginal) => ({
  ...(await importOriginal<typeof WatchlistModule>()),
  useWatchlistUniverse: () => watchlist.current,
}));
vi.mock('@/features/market', async (importOriginal) => ({
  ...(await importOriginal<typeof MarketModule>()),
  CandleChart: ({ candles }: { candles: readonly unknown[] }) => (
    <div>{candles.length} candles drawn</div>
  ),
}));

function wireQuote(
  ticker: string,
  kind: 'stock' | 'etf' | 'index' | 'crypto',
  changeRatio: number,
) {
  return {
    ticker,
    name: `${ticker} name`,
    exchange: kind === 'etf' ? 'AMEX' : 'NASDAQ',
    kind,
    price: 100,
    change: changeRatio * 100,
    changeRatio,
    open: 99,
    previousClose: 98,
    dayHigh: 101,
    dayLow: 97,
    yearHigh: 150,
    yearLow: 80,
    volume: 1_500_000,
    marketCap: 2_000_000_000_000,
    average50: 95,
    average200: 90,
    asOf: '2026-10-23T20:00:00+00:00',
  };
}

const CANDLES = [
  { date: '2026-10-01', open: 1, high: 2, low: 0.5, close: 100, volume: 10 },
  { date: '2026-10-02', open: 1, high: 2, low: 0.5, close: 110, volume: 10 },
];

/** The backend: quotes for the watchlist, candles for any ticker. */
function backend({ quotesFail = false } = {}) {
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url === '/market-data/quotes') {
      if (quotesFail) return Promise.reject(new ApiError('FMP is unavailable', 503, 'ERR'));
      return Promise.resolve({
        quotes: [
          wireQuote('NVDA', 'stock', 0.02),
          wireQuote('SPY', 'etf', -0.01),
          wireQuote('AAPL', 'stock', 0),
        ],
        missing: ['ZZZZ'],
      });
    }
    if (url === '/market-data/candles') return Promise.resolve({ ticker: 'X', candles: CANDLES });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function candleRequests() {
  return vi
    .mocked(apiClient.get)
    .mock.calls.filter(([url]) => url === '/market-data/candles')
    .map(([, config]) => (config as { params: { ticker: string; start: string } }).params);
}

beforeEach(() => {
  vi.clearAllMocks();
  watchlist.current = {
    tickers: ['NVDA', 'SPY', 'AAPL', 'ZZZZ'],
    isEdited: false,
    isLoading: false,
    isUnavailable: false,
  };
});

it('points to the dashboard when the watchlist is empty', () => {
  watchlist.current = { ...watchlist.current, tickers: [] };

  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });

  expect(screen.getByText('Your watchlist is empty')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toBeInTheDocument();
  expect(apiClient.get).not.toHaveBeenCalled();
});

it('lists the watchlist grouped Stocks then ETFs, with the first row selected', async () => {
  backend();

  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });

  const list = await screen.findByRole('listbox', { name: 'Watchlist quotes' });
  const groups = within(list).getAllByRole('group');
  expect(groups).toHaveLength(2);
  expect(within(groups[0]!).getByText('Stocks')).toBeInTheDocument();
  expect(within(groups[1]!).getByText('ETFs')).toBeInTheDocument();
  expect(
    within(list)
      .getAllByRole('option')
      .map((row) => row.textContent),
  ).toEqual([
    expect.stringContaining('NVDA'),
    expect.stringContaining('AAPL'),
    expect.stringContaining('SPY'),
  ]);
  expect(within(list).getByRole('option', { name: /NVDA/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByText('+2.00%', { selector: '[role="option"] span' })).toBeInTheDocument();
  expect(screen.getByText('No quote from FMP for ZZZZ.')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith(
    '/market-data/quotes',
    expect.objectContaining({ params: { tickers: 'NVDA,SPY,AAPL,ZZZZ' } }),
  );
  expect(await screen.findByText('2 candles drawn')).toBeInTheDocument();
  expect(screen.getByText('NVDA · 30D')).toBeInTheDocument();
  expect(screen.getByText('52-week range')).toBeInTheDocument();
});

it('charts and details the row that is clicked', async () => {
  backend();
  const user = userEvent.setup();
  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });

  await user.click(await screen.findByRole('option', { name: /SPY/ }));

  expect(screen.getByRole('option', { name: /SPY/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('SPY · 30D')).toBeInTheDocument();
  expect(screen.getByText('ETFs', { selector: 'span' })).toBeInTheDocument();
  expect(candleRequests().map((params) => params.ticker)).toContain('SPY');
});

it('moves the selection with the arrow keys in display order', async () => {
  backend();
  const user = userEvent.setup();
  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });
  const list = await screen.findByRole('listbox', { name: 'Watchlist quotes' });

  list.focus();
  await user.keyboard('{ArrowDown}{ArrowDown}');

  expect(screen.getByRole('option', { name: /SPY/ })).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{ArrowUp}');
  expect(screen.getByRole('option', { name: /AAPL/ })).toHaveAttribute('aria-selected', 'true');
});

it('opens on the ticker in the URL', async () => {
  backend();

  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener?ticker=aapl'] });

  expect(await screen.findByRole('option', { name: /AAPL/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByText('AAPL · 30D')).toBeInTheDocument();
});

it('groups an index on its own, keeps it selected, and hides the zeros FMP sends for it', async () => {
  watchlist.current = { ...watchlist.current, tickers: ['AAPL', '^VIX'] };
  const vix = { ...wireQuote('^VIX', 'index', 0.02), exchange: 'INDEX', marketCap: 0, volume: 0 };
  vi.mocked(apiClient.get).mockImplementation((url) =>
    Promise.resolve(
      url === '/market-data/quotes'
        ? { quotes: [wireQuote('AAPL', 'stock', 0), vix], missing: [] }
        : { ticker: 'X', candles: CANDLES },
    ),
  );
  const user = userEvent.setup();
  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });

  await user.click(await screen.findByRole('option', { name: /\^VIX/ }));

  expect(screen.getByRole('option', { name: /\^VIX/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Indices', { selector: 'p' })).toBeInTheDocument();
  expect(screen.getByText('^VIX · 30D')).toBeInTheDocument();
  const marketCap = screen.getByText('Market cap').nextElementSibling;
  expect(marketCap).toHaveTextContent('—');
});

it('asks for a longer window when the period changes', async () => {
  backend();
  const user = userEvent.setup();
  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });
  await screen.findByText('2 candles drawn');

  await user.click(screen.getByRole('radio', { name: '1Y' }));

  expect(screen.getByText('NVDA · 1Y')).toBeInTheDocument();
  const starts = candleRequests().map((params) => params.start);
  expect(new Set(starts).size).toBe(2);
});

it('says when the quotes cannot be loaded and offers to try again', async () => {
  backend({ quotesFail: true });

  renderWithProviders(<StockScreenerPage />, { routes: ['/tools/screener'] });

  expect(await screen.findByText('Quotes could not be loaded')).toBeInTheDocument();
  expect(screen.getByText('FMP is unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
