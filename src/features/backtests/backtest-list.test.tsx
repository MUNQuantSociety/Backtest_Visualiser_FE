import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders, screen } from '@/test/test-utils';

import { BacktestList } from './backtest-list';
import * as api from './backtests-api';
import type { BacktestSummary } from './types';

vi.mock('../api/backtests-api');

const fetchBacktests = vi.mocked(api.fetchBacktests);

function makeSummary(overrides: Partial<BacktestSummary> = {}): BacktestSummary {
  return {
    id: 'bt-1',
    name: 'Momentum v3',
    strategyId: 'strat-1',
    strategyName: 'Momentum',
    symbol: 'AAPL',
    timeframe: '1d',
    status: 'completed',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    createdAt: '2024-01-02T10:00:00Z',
    initialCapital: 100_000,
    finalEquity: 124_500,
    totalReturn: 0.245,
    sharpe: 1.62,
    maxDrawdown: -0.113,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BacktestList', () => {
  it('renders a card per backtest with formatted metrics', async () => {
    fetchBacktests.mockResolvedValue({
      items: [makeSummary(), makeSummary({ id: 'bt-2', name: 'Mean reversion' })],
      total: 2,
      page: 1,
      pageSize: 25,
    });

    renderWithProviders(<BacktestList />);

    expect(await screen.findByText('Momentum v3')).toBeInTheDocument();
    expect(screen.getByText('Mean reversion')).toBeInTheDocument();
    // Gains render with an explicit sign so they are unambiguous at a glance.
    expect(screen.getAllByText('+24.50%')).toHaveLength(2);
    expect(screen.getAllByText('1.62')).toHaveLength(2);
  });

  it('shows the error message when the request fails', async () => {
    fetchBacktests.mockRejectedValue(new ApiError('Backend unavailable', 503, 'HTTP_503'));

    renderWithProviders(<BacktestList />);

    expect(await screen.findByText('Could not load backtests')).toBeInTheDocument();
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
  });

  it('shows an empty state rather than a bare grid when there are no results', async () => {
    fetchBacktests.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });

    renderWithProviders(<BacktestList />);

    expect(await screen.findByText('No backtests yet')).toBeInTheDocument();
  });

  it('passes filters through to the API', async () => {
    fetchBacktests.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });

    renderWithProviders(<BacktestList filters={{ status: 'failed', pageSize: 10 }} />);

    await screen.findByText('No backtests yet');
    expect(fetchBacktests).toHaveBeenCalledWith({ status: 'failed', pageSize: 10 });
  });
});
