import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '@/test/test-utils';

import { SentimentGateSummary } from './sentiment-gate-summary';
import type { BacktestDetail } from './types';

function makeDetail(overrides: Partial<BacktestDetail> = {}): BacktestDetail {
  return {
    id: 'bt-1',
    name: 'Momentum',
    strategyId: 'portfolio_2',
    strategyName: 'Momentum',
    symbol: 'MULTI',
    timeframe: '1d',
    status: 'completed',
    startDate: '2026-05-01',
    endDate: '2026-05-29',
    createdAt: '2026-07-16T10:00:00Z',
    initialCapital: 100_000,
    finalEquity: 95_021,
    totalReturn: -0.05,
    sharpe: 0,
    maxDrawdown: 0,
    progressPct: 100,
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

const gated = {
  enabled: true,
  threshold: -0.25,
  window: '7d',
  blockedEntryCount: 3,
  coverage: {
    AAPL: { articleCount: 1022, firstAvailable: '2026-04-23T06:43:00+00:00' },
    MSFT: { articleCount: 0, firstAvailable: null },
  },
};

describe('SentimentGateSummary', () => {
  it('reports the threshold and how many entries the gate blocked', () => {
    renderWithProviders(
      <SentimentGateSummary run={makeDetail({ reportMetadata: { sentimentGate: gated } })} />,
    );

    expect(screen.getByText(/long entries/)).toHaveTextContent('-0.25 blocked 3 long entries');
  });

  it('lists each ticker’s news coverage', () => {
    renderWithProviders(
      <SentimentGateSummary run={makeDetail({ reportMetadata: { sentimentGate: gated } })} />,
    );

    expect(screen.getByText(/News available/)).toHaveTextContent(
      'AAPL 1,022 articles from 2026-04-23 · MSFT none',
    );
  });

  it('warns that a ticker without news was never gated', () => {
    renderWithProviders(
      <SentimentGateSummary run={makeDetail({ reportMetadata: { sentimentGate: gated } })} />,
    );

    expect(screen.getByText(/never blocked it/)).toBeInTheDocument();
  });

  it('renders nothing for an ungated run', () => {
    const { container } = renderWithProviders(
      <SentimentGateSummary
        run={makeDetail({ reportMetadata: { sentimentGate: { enabled: false } } })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing before a run completes', () => {
    const { container } = renderWithProviders(
      <SentimentGateSummary
        run={makeDetail({ status: 'running', reportMetadata: { sentimentGate: gated } })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
