import { describe, expect, it } from 'vitest';

import {
  chipSummary,
  compareContext,
  compareMetricRows,
  deltaTone,
  describeComparison,
  parameterRows,
  positiveDays,
  winnerIndex,
  type CompareMetricRow,
} from './compare-model';
import type { BacktestDetail } from './types';

function detail(overrides: Partial<BacktestDetail> = {}): BacktestDetail {
  return {
    id: 'a',
    name: 'A',
    strategyId: 'vol-momentum',
    strategyName: 'VolMomentum',
    symbol: 'AAPL',
    timeframe: '1d',
    status: 'completed',
    startDate: '2023-01-03',
    endDate: '2024-12-31',
    createdAt: '2025-01-01T00:00:00Z',
    initialCapital: 1_000_000,
    finalEquity: 1_200_000,
    totalReturn: 0.2,
    sharpe: 1.5,
    maxDrawdown: -0.1,
    metrics: {
      totalReturn: 0.2,
      cagr: 0.1,
      sharpe: 1.5,
      sortino: 1.8,
      maxDrawdown: -0.1,
      volatility: 0.15,
      winRate: 0.55,
      profitFactor: 1.6,
      totalTrades: 40,
    },
    equityCurve: [
      { date: '2023-01-03', equity: 100, benchmark: 100 },
      { date: '2023-01-04', equity: 101, benchmark: 100.5 },
      { date: '2023-01-05', equity: 100.5, benchmark: 101 },
      { date: '2023-01-06', equity: 102, benchmark: 101.2 },
    ],
    trades: [],
    parameters: { lookback: 20, entryZ: 1.5, exitZ: 0.4, slippageBps: 5 },
    progressPct: null,
    errorMessage: null,
    ...overrides,
  };
}

const A = detail();
const B = detail({
  id: 'b',
  name: 'B',
  parameters: { lookback: 40, entryZ: 1.5, exitZ: 0.4, slippageBps: 5 },
});

describe('positiveDays', () => {
  it('is the share of up sessions', () => {
    // +1, -0.5, +1.5 → two of three sessions closed up.
    expect(positiveDays(A)).toBeCloseTo(2 / 3, 10);
  });
});

describe('winnerIndex / deltaTone', () => {
  const row = (better: CompareMetricRow['better'], values: number[]): CompareMetricRow => ({
    key: 'k',
    label: 'k',
    better,
    values,
    format: String,
    formatDelta: String,
  });

  it('picks the higher value when higher is better, and the lower otherwise', () => {
    expect(winnerIndex(row('high', [1, 2]))).toBe(1);
    expect(winnerIndex(row('low', [1, 2]))).toBe(0);
  });

  it('has no winner for a tie or a neutral metric', () => {
    expect(winnerIndex(row('high', [2, 2]))).toBeNull();
    expect(winnerIndex(row('neutral', [1, 2]))).toBeNull();
  });

  it('colours A − B by whether A is the better side', () => {
    expect(deltaTone(row('high', [2, 1]))).toBe('profit');
    expect(deltaTone(row('high', [1, 2]))).toBe('loss');
    // Lower volatility is better, so A being lower is A winning.
    expect(deltaTone(row('low', [0.1, 0.2]))).toBe('profit');
    expect(deltaTone(row('neutral', [0.1, 0.2]))).toBe('neutral');
  });
});

describe('parameterRows / compareContext / describeComparison', () => {
  it('flags only the differing key', () => {
    const rows = parameterRows([A, B]);
    expect(rows.find((r) => r.key === 'lookback')).toMatchObject({
      values: ['20', '40'],
      differs: true,
    });
    expect(rows.find((r) => r.key === 'entryZ')).toMatchObject({ differs: false });
  });

  it('describes a one-parameter comparison as isolating that parameter', () => {
    const context = compareContext([A, B]);
    expect(context).toMatchObject({
      sameStrategy: true,
      sameWindow: true,
      sameUniverse: true,
      differingKeys: ['lookback'],
    });
    expect(describeComparison(context, 2)).toMatch(/One parameter differs/);
  });

  it('names what differs when the runs are not like for like', () => {
    const context = compareContext([
      A,
      detail({ id: 'c', symbol: 'MSFT', startDate: '2022-01-03' }),
    ]);
    expect(describeComparison(context, 2)).toMatch(/differ in window and universe/);
  });
});

describe('compareMetricRows / chipSummary', () => {
  it('builds ten rows with one value per run', () => {
    const rows = compareMetricRows([A, B]);
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.values.length === 2)).toBe(true);
    expect(rows.find((r) => r.key === 'trades')?.better).toBe('neutral');
  });

  it('summarises a run the way the chip shows it', () => {
    expect(chipSummary(A)).toBe('2023-01-03 → 2024-12-31 · 1d · lb 20 · z 1.5 / 0.4 · $1M · 5 bps');
  });
});
