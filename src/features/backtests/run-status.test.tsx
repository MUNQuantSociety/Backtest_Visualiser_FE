import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '@/test/test-utils';

import { RunStatusBanner } from './run-status';
import type { BacktestDetail } from './types';

/**
 * The banner is the only thing on the detail page that speaks for a run with no
 * results. Every panel beside it renders empty for a queued, running or failed
 * run, so if this is wrong the page just looks broken.
 */

function makeDetail(overrides: Partial<BacktestDetail> = {}): BacktestDetail {
  return {
    id: 'bt-1',
    name: 'Momentum',
    strategyId: 'portfolio_1',
    strategyName: 'VolMomentum',
    symbol: 'MULTI',
    timeframe: '1d',
    status: 'running',
    startDate: '2026-01-02',
    endDate: '2026-07-15',
    createdAt: '2026-07-16T10:00:00Z',
    initialCapital: 100_000,
    finalEquity: 100_000,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
    progressPct: 42,
    errorMessage: null,
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
    parameters: {},
    ...overrides,
  };
}

describe('RunStatusBanner', () => {
  it('shows progress for a running backtest', () => {
    renderWithProviders(<RunStatusBanner run={makeDetail({ progressPct: 42 })} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('shows a queued run as queued rather than as broken', () => {
    renderWithProviders(<RunStatusBanner run={makeDetail({ status: 'queued', progressPct: 0 })} />);

    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows the reason a run failed', () => {
    renderWithProviders(
      <RunStatusBanner
        run={makeDetail({
          status: 'failed',
          progressPct: null,
          errorMessage: 'KeyError: TSLA not in the loaded window',
        })}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/KeyError: TSLA/)).toBeInTheDocument();
  });

  it('says so when a failure carries no reason, rather than rendering a blank', () => {
    renderWithProviders(
      <RunStatusBanner run={makeDetail({ status: 'failed', errorMessage: null })} />,
    );

    expect(screen.getByText(/No reason was recorded/)).toBeInTheDocument();
  });

  it('renders nothing for a finished run', () => {
    const { container } = renderWithProviders(
      <RunStatusBanner run={makeDetail({ status: 'completed', progressPct: 100 })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('omits the bar when progress is unknown', () => {
    renderWithProviders(<RunStatusBanner run={makeDetail({ progressPct: null })} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
