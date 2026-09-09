import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { backtestDetailSchema, type BacktestDetail } from '@/features/backtests';

import { MetricsGrid } from './metric-grid';
import { buildTearsheet } from './tearsheet';

const detail: BacktestDetail = {
  id: 'real-run',
  name: 'Report',
  strategyId: 'strategy',
  strategyName: 'Strategy',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'completed',
  startDate: '2026-01-01',
  endDate: '2026-01-03',
  createdAt: '2026-01-04T00:00:00Z',
  initialCapital: 100,
  finalEquity: 110,
  totalReturn: 0.1,
  sharpe: 1,
  maxDrawdown: -0.01,
  metrics: {
    totalReturn: 0.1,
    cagr: 0.2,
    sharpe: 1,
    sortino: 1,
    maxDrawdown: -0.01,
    volatility: 0.1,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    unavailable: { winRate: 'No closed trades.', profitFactor: 'No losing closed trades.' },
  },
  equityCurve: [
    { date: '2026-01-01', equity: 100, benchmark: 100 },
    { date: '2026-01-03', equity: 110, benchmark: 101 },
  ],
  trades: [],
  parameters: {},
  progressPct: 100,
  errorMessage: null,
  reportMetadata: { fill_count: 1 },
  openPositions: [{ unrealizedPnl: 10 }],
};

describe('persisted backend report contract', () => {
  it('preserves availability, provenance and separate unrealized values at the API boundary', () => {
    const parsed = backtestDetailSchema.parse(detail);
    expect(parsed.metrics.unavailable?.winRate).toBe('No closed trades.');
    expect(parsed.reportMetadata?.['fill_count']).toBe(1);
    expect(parsed.openPositions?.[0]?.['unrealizedPnl']).toBe(10);
  });

  it('does not display undefined profit factor and win rate as numeric zeros', () => {
    render(<MetricsGrid metrics={detail.metrics} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('keeps undefined metrics unavailable and counts fills distinctly from paired lots', () => {
    const rows = buildTearsheet(detail).flatMap((section) => section.rows);
    expect(rows.find((row) => row.label === 'Win rate')?.value).toBeNull();
    expect(rows.find((row) => row.label === 'Profit factor')?.value).toBeNull();
    expect(rows.find((row) => row.label === 'Total fills')?.value).toBe(1);
    expect(rows.find((row) => row.label === 'Trade lots')?.value).toBe(0);
  });
});
