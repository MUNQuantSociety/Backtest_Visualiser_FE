import '@/test/storage-global';

import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWatchlistStore } from '@/features/watchlist';
import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';

import TickerPage from './ticker-page';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const get = vi.mocked(apiClient.get);

function strategy(id: string, name: string, universe: string[]) {
  return {
    id,
    name,
    className: name,
    description: '',
    status: 'active',
    tags: [],
    parameters: [],
    universe,
    runCount: 1,
    bestSharpe: 1,
    bestReturn: 0.1,
    lastRunAt: '2026-01-01T00:00:00Z',
  };
}

function run(id: string, name: string, strategyId: string, symbol: string) {
  return {
    id,
    name,
    strategyId,
    strategyName: strategyId,
    symbol,
    timeframe: '1d',
    status: 'completed',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    createdAt: '2026-01-01T00:00:00Z',
    initialCapital: 100_000,
    finalEquity: 110_000,
    totalReturn: 0.1,
    sharpe: 1,
    maxDrawdown: -0.05,
  };
}

const STRATEGIES = [
  strategy('momentum', 'Vol Momentum', ['AAPL', 'MSFT']),
  strategy('meanrev', 'Mean Reversion', ['TSLA']),
];
const RUNS = [
  run('r1', 'Momentum run', 'momentum', 'MULTI'),
  run('r2', 'AAPL solo run', 'other', 'AAPL'),
  run('r3', 'Tesla run', 'meanrev', 'TSLA'),
];

function renderAt(path: string) {
  renderWithProviders(
    <Routes>
      <Route path="/tickers/:ticker" element={<TickerPage />} />
    </Routes>,
    { routes: [path] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useWatchlistStore.getState().reset();
  get.mockImplementation((url) => {
    if (url === '/strategies') return Promise.resolve({ items: STRATEGIES, total: 2 });
    if (url === '/backtests')
      return Promise.resolve({ items: RUNS, total: RUNS.length, page: 1, pageSize: 100 });
    if (url === '/indicators' || url === '/news') return Promise.resolve({ items: [] });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

describe('TickerPage', () => {
  it('links to the ticker on Perplexity Finance in a new tab', () => {
    renderAt('/tickers/AAPL');

    const link = screen.getByRole('link', { name: /Perplexity Finance/ });
    expect(link).toHaveAttribute('href', 'https://www.perplexity.ai/finance/AAPL');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('upper-cases a lower-case symbol in the URL', () => {
    renderAt('/tickers/aapl');

    expect(screen.getByRole('heading', { level: 1, name: 'AAPL' })).toBeInTheDocument();
  });

  it('says a malformed symbol is not a ticker and makes no requests for it', () => {
    renderAt('/tickers/not%20a%20ticker');

    expect(screen.getByRole('heading', { name: 'Not a ticker' })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('lists the active strategies that trade the ticker', async () => {
    renderAt('/tickers/AAPL');

    expect(await screen.findByRole('link', { name: /Vol Momentum/ })).toHaveAttribute(
      'href',
      '/backtests?strategy=momentum',
    );
    expect(screen.queryByRole('link', { name: /Mean Reversion/ })).not.toBeInTheDocument();
  });

  it('shows runs on the ticker alone and runs of strategies that trade it', async () => {
    renderAt('/tickers/AAPL');

    expect(await screen.findByRole('link', { name: /Momentum run/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AAPL solo run/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tesla run/ })).not.toBeInTheDocument();
  });

  it('removes a universe ticker from the watchlist, and adds it back', async () => {
    renderAt('/tickers/AAPL');
    const toggle = await screen.findByRole('button', { name: 'Remove from watchlist' });

    await userEvent.click(toggle);

    expect(useWatchlistStore.getState().removed).toEqual(['AAPL']);
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }));
    expect(useWatchlistStore.getState()).toMatchObject({ added: ['AAPL'], removed: [] });
  });

  it('offers to watch a ticker no strategy trades', async () => {
    renderAt('/tickers/NVDA');

    expect(await screen.findByText('No active strategy trades this ticker.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }));
    expect(useWatchlistStore.getState().added).toEqual(['NVDA']);
  });

  it('says so when the ticker has no indicators', async () => {
    renderAt('/tickers/AAPL');

    expect(await screen.findByText('No indicators reported for this ticker.')).toBeInTheDocument();
    expect(within(document.body).queryByRole('region', { name: 'Indicators' })).toBeNull();
  });
});
