import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';

import LibraryPage from './library-page';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});
vi.mock('@/features/performance', () => ({
  DailyPnlBars: () => null,
  EquityCurveChart: () => null,
  MetricsGrid: () => null,
  MonthlyReturnsHeatmap: () => null,
}));

const run = {
  id: 'current-run',
  name: 'Current strategy run',
  strategyId: 'current',
  strategyName: 'Current strategy',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'completed',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  createdAt: '2026-01-01T00:00:00Z',
  initialCapital: 100_000,
  finalEquity: 100_000,
  totalReturn: 0,
  sharpe: 0,
  maxDrawdown: 0,
};
const retiredRun = {
  ...run,
  id: 'retired-run',
  name: 'Retired strategy run',
  strategyId: 'retired',
  strategyName: 'Retired strategy',
};
const strategy = {
  id: 'current',
  name: 'Current strategy',
  className: 'CurrentStrategy',
  description: 'A current strategy.',
  status: 'active',
  tags: [],
  parameters: [],
  universe: ['AAPL'],
  runCount: 13,
  bestSharpe: 9,
  bestReturn: 1,
  lastRunAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url === '/strategies') return Promise.resolve({ items: [strategy], total: 1 });
    if (url === '/backtests')
      return Promise.resolve({ items: [run, retiredRun], total: 2, page: 1, pageSize: 25 });
    if (url === '/backtests/current-run')
      return Promise.resolve({
        ...run,
        metrics: {
          totalReturn: 0,
          cagr: 0,
          sharpe: 0,
          sortino: 0,
          maxDrawdown: 0,
          volatility: 0,
          winRate: 0,
          profitFactor: 0,
          totalTrades: 0,
        },
        equityCurve: [],
        trades: [],
      });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

describe('Backtests hub', () => {
  it('starts with every saved run, including retired strategies, and exposes both creation actions', async () => {
    renderWithProviders(<LibraryPage />, { routes: ['/backtests'] });
    expect(screen.getByRole('heading', { name: 'Backtests', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Retired strategy run' })).toHaveAttribute(
      'href',
      '/backtests/retired-run',
    );
    expect(screen.getByRole('link', { name: 'Current strategy run' })).toHaveAttribute(
      'href',
      '/backtests/current-run',
    );
    expect(screen.getByRole('button', { name: 'All runs (2)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'New strategy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run backtest' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Strategy preview' })).not.toBeInTheDocument();
    const picker = screen.getByRole('option', { name: /Current strategy/ });
    expect(within(picker).getByText('Runs').nextElementSibling).toHaveTextContent('1');
    expect(within(picker).queryByText('13')).not.toBeInTheDocument();
  });

  it('keeps bookmarked strategy filters, then returns to all saved runs with one click', async () => {
    renderWithProviders(<LibraryPage />, { routes: ['/backtests?strategy=current'] });
    const currentLink = await screen.findByRole('link', { name: 'Current strategy run' });
    expect(screen.queryByRole('link', { name: 'Retired strategy run' })).not.toBeInTheDocument();
    const preview = screen.getByRole('heading', { name: 'Strategy preview' });
    expect(
      currentLink.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'All runs (2)' }));
    expect(await screen.findByRole('link', { name: 'Retired strategy run' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Strategy preview' })).not.toBeInTheDocument();
  });
});
