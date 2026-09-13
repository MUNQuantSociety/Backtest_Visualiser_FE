import { describe, expect, it } from 'vitest';

import type { EquityPoint, Trade } from '@/features/backtests';
import {
  drawdownEpisodes,
  drawdownSeries,
  monthlyReturns,
  rollingSharpe,
  rollingVolatility,
} from '@/utils/metrics';

import {
  benchmarkRegression,
  dailyPnl,
  datedReturns,
  returnDistribution,
  sampleTradeMarkers,
  tradeMarkers,
} from './chart-data';

function curve(returns: number[], benchmarkReturns = returns): EquityPoint[] {
  let equity = 100;
  let benchmark = 100;
  return [
    { date: '2026-01-01', equity, benchmark },
    ...returns.map((value, index) => {
      equity *= 1 + value;
      benchmark *= 1 + (benchmarkReturns[index] ?? 0);
      return { date: `2026-01-${String(index + 2).padStart(2, '0')}`, equity, benchmark };
    }),
  ];
}

describe('report chart calculations', () => {
  it('reconciles monthly compounding and daily P&L, including the first session', () => {
    const data = [
      { date: '2025-12-30', equity: 90 },
      { date: '2025-12-31', equity: 99 },
      { date: '2026-01-02', equity: 108.9 },
      { date: '2026-02-02', equity: 100 },
    ];
    const rows = monthlyReturns(data, 100);
    expect(rows[0]?.months[11]).toBeCloseTo(-0.01, 12);
    expect(rows[1]?.months[0]).toBeCloseTo(0.1, 12);
    expect(rows.reduce((factor, row) => factor * (1 + row.ytd), 1)).toBeCloseTo(1, 12);
    const pnl = dailyPnl(data, 100);
    expect(pnl[0]?.change).toBe(-10);
    expect(pnl.reduce((sum, point) => sum + point.change, 0)).toBeCloseTo(0, 12);
    expect(pnl.at(-1)?.cumulative).toBe(0);
    expect(monthlyReturns([data[0]!], 100)[0]?.ytd).toBeCloseTo(-0.1, 12);
  });

  it('keeps invalid return dates and missing benchmark intervals aligned', () => {
    const data = curve([0.1, -0.1, 0.2, 0.05, -0.03]);
    data[1]!.benchmark = null;
    data[2]!.equity = 0;
    const rows = datedReturns(data);
    expect(rows.map((row) => row.date)).toEqual(data.slice(1).map((point) => point.date));
    expect(rows[0]?.benchmark).toBeNull();
    expect(rows[1]?.benchmark).toBeNull();
    expect(rows[2]?.strategy).toBeNull();
    expect(rows[2]?.benchmark).toBeCloseTo(0.2, 12);
    expect(
      rollingVolatility(
        rows.map((point) => point.benchmark),
        2,
      ).slice(0, 3),
    ).toEqual([null, null, null]);
    expect(
      rollingVolatility(
        rows.map((point) => point.benchmark),
        2,
      )[3],
    ).toBeCloseTo((0.15 / Math.sqrt(2)) * Math.sqrt(252), 10);
  });

  it('uses complete rolling windows, sample variance and the annual risk-free rate', () => {
    const values = [0.01, 0.02, 0.015, 0.005];
    const sd = Math.sqrt(0.000125 / 3);
    expect(rollingVolatility(values, 4)).toEqual([null, null, null, sd * Math.sqrt(252)]);
    expect(rollingSharpe(values, 4)[3]).toBeCloseTo(
      ((0.0125 - 0.02 / 252) / sd) * Math.sqrt(252),
      12,
    );
    expect(rollingSharpe([0.01, null, 0.03, 0.04], 3)).toEqual([null, null, null, null]);
    expect(
      rollingSharpe(
        Array.from({ length: 63 }, () => 0),
        63,
      ).at(-1),
    ).toBeNull();
    expect(
      rollingVolatility(
        Array.from({ length: 63 }, () => 0),
        63,
      ).at(-1),
    ).toBe(0);
  });

  it('fits only matched intervals and leaves an unidentifiable regression unavailable', () => {
    const xs = [0.01, -0.02, 0.03, -0.01, 0.02, 0.04, -0.03, 0.01, 0.02, -0.01];
    const data = curve(
      xs.map((value) => 0.001 + 0.5 * value),
      xs,
    );
    data[4]!.benchmark = null;
    const fit = benchmarkRegression(data);
    expect(fit?.points).toHaveLength(8);
    expect(fit?.points.some((point) => ['2026-01-05', '2026-01-06'].includes(point.date))).toBe(
      false,
    );
    expect(fit?.fit.alpha).toBeCloseTo(0.001, 12);
    expect(fit?.fit.beta).toBeCloseTo(0.5, 12);
    expect(fit?.fit.r2).toBeCloseTo(1, 12);
    expect(
      benchmarkRegression(
        curve(
          xs,
          xs.map(() => 0),
        ),
      ),
    ).toBeNull();
    expect(
      benchmarkRegression(
        curve(
          xs.map(() => 0),
          xs,
        ),
      )?.fit.r2,
    ).toBeNaN();
  });

  it('counts every return, including flat runs, and uses an empirical quantile', () => {
    const model = returnDistribution(
      curve([-0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04]),
    );
    expect(model?.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(9);
    expect(model?.var95).toBeCloseTo(-0.036, 12);
    const flat = returnDistribution(curve(Array.from({ length: 10 }, () => 0)));
    expect(flat?.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(10);
    expect(flat?.hasNormalFit).toBe(false);
    expect(flat?.var95).toBe(0);
  });

  it('measures recovered and ongoing drawdowns from the running peak', () => {
    const data = [100, 120, 90, 110, 120, 108].map((equity, index) => ({
      date: `2026-01-0${String(index + 1)}`,
      equity,
    }));
    const dd = drawdownSeries(data.map((point) => point.equity));
    expect(dd[2]?.drawdown).toBe(-0.25);
    expect(dd[4]?.drawdown).toBe(0);
    expect(drawdownEpisodes(data)).toEqual([
      {
        depth: -0.25,
        peakDate: '2026-01-02',
        valleyDate: '2026-01-03',
        recoveryDate: '2026-01-05',
        lengthBars: 3,
        recoveryBars: 2,
        ongoing: false,
      },
      {
        depth: dd[5]!.drawdown,
        peakDate: '2026-01-05',
        valleyDate: '2026-01-06',
        recoveryDate: null,
        lengthBars: 1,
        recoveryBars: null,
        ongoing: true,
      },
    ]);
  });
});

describe('recorded trade markers', () => {
  const trade: Trade = {
    id: 'lot',
    symbol: 'AAPL',
    side: 'long',
    entryDate: '2026-01-01',
    exitDate: '2026-01-02',
    entryPrice: 10,
    exitPrice: 11,
    quantity: 1,
    pnl: 1,
    returnPct: 0.1,
    fees: 0,
  };
  const data = curve([0.01, 0.02]);

  it('keeps high-volume runs visible and aggregates lots without losing entries or exits', () => {
    const markers = tradeMarkers(
      data,
      Array.from({ length: 910 }, (_, index) => ({ ...trade, id: String(index) })),
    );
    expect(markers).toEqual([
      { date: '2026-01-01', action: 'Buy', count: 910 },
      { date: '2026-01-02', action: 'Sell', count: 910 },
    ]);
  });

  it('treats short entries as sells and covers as buys, without fabricating open exits', () => {
    expect(tradeMarkers(data, [{ ...trade, side: 'short' }])).toEqual([
      { date: '2026-01-01', action: 'Sell', count: 1 },
      { date: '2026-01-02', action: 'Buy', count: 1 },
    ]);
    expect(tradeMarkers(data, [{ ...trade, exitDate: null }])).toHaveLength(1);
    expect(tradeMarkers(data.slice(1), [trade])).toEqual([
      { date: '2026-01-02', action: 'Sell', count: 1 },
    ]);
  });

  it('samples only actual event dates and restores every marker in a smaller interval', () => {
    const events = Array.from({ length: 60 }, (_, index) => ({
      date: `date-${String(index).padStart(2, '0')}`,
      action: index % 2 === 0 ? ('Buy' as const) : ('Sell' as const),
      count: 3,
    }));
    const sampled = sampleTradeMarkers(events, 10);
    expect(sampled).toHaveLength(20);
    expect(sampled.every((event) => events.includes(event))).toBe(true);
    expect(sampleTradeMarkers(events.slice(0, 10), 10)).toEqual(events.slice(0, 10));
  });
});
