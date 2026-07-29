import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders, screen } from '@/test/test-utils';

import * as api from '../api/portfolios-api';
import type { PortfolioSummary } from '../types/portfolio';

import { PortfolioList } from './portfolio-list';

vi.mock('../api/portfolios-api');

const fetchPortfolios = vi.mocked(api.fetchPortfolios);

function makeSummary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    id: '1',
    name: 'Volatility Momentum',
    strategyClass: 'VolMomentum',
    state: 'running',
    tickers: ['AAPL', 'NVDA'],
    allocationWeight: 0.2,
    totalValue: 224_500,
    cash: 26_940,
    dayPnl: 1_240.5,
    totalPnl: 24_500,
    totalReturn: 0.1225,
    lastTickAt: '2026-07-29T13:30:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PortfolioList', () => {
  it('renders a card per portfolio with formatted figures', async () => {
    fetchPortfolios.mockResolvedValue({
      items: [makeSummary(), makeSummary({ id: '2', name: 'Mean Reversion' })],
      total: 2,
      page: 1,
      pageSize: 25,
    });

    renderWithProviders(<PortfolioList />);

    expect(await screen.findByText('Volatility Momentum')).toBeInTheDocument();
    expect(screen.getByText('Mean Reversion')).toBeInTheDocument();
    // Gains carry an explicit sign so they are unambiguous at a glance.
    expect(screen.getAllByText('+12.25%')).toHaveLength(2);
  });

  it('distinguishes a halted engine from a merely stopped one', async () => {
    fetchPortfolios.mockResolvedValue({
      items: [
        makeSummary({ id: '5', state: 'halted' }),
        makeSummary({ id: '6', name: 'Screener', state: 'stopped' }),
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });

    renderWithProviders(<PortfolioList />);

    expect(await screen.findByText('Halted')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('caps the rendered cards when a limit is given', async () => {
    fetchPortfolios.mockResolvedValue({
      items: [
        makeSummary({ id: '1', name: 'One' }),
        makeSummary({ id: '2', name: 'Two' }),
        makeSummary({ id: '3', name: 'Three' }),
      ],
      total: 3,
      page: 1,
      pageSize: 25,
    });

    renderWithProviders(<PortfolioList limit={2} />);

    expect(await screen.findByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();
  });

  it('shows the error message when the request fails', async () => {
    fetchPortfolios.mockRejectedValue(new ApiError('Engine unreachable', 503, 'HTTP_503'));

    renderWithProviders(<PortfolioList />);

    expect(await screen.findByText('Could not load portfolios')).toBeInTheDocument();
    expect(screen.getByText('Engine unreachable')).toBeInTheDocument();
  });

  it('explains an empty result rather than rendering a bare grid', async () => {
    fetchPortfolios.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });

    renderWithProviders(<PortfolioList />);

    expect(await screen.findByText('No portfolios configured')).toBeInTheDocument();
  });
});
