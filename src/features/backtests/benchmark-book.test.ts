import { describe, expect, it } from 'vitest';

import {
  buyHoldCurve,
  closesCurve,
  topRunsByReturn,
  valuesAt,
  withBenchmarkCloses,
  type BenchmarkClose,
} from './benchmark-book';
import type { EquityPoint } from './types';

function run(id: string, equities: number[], benchmarks?: number[]) {
  const equityCurve: EquityPoint[] = equities.map((equity, index) => ({
    date: `2026-03-0${String(index + 1)}`,
    equity,
    ...(benchmarks ? { benchmark: benchmarks[index] } : {}),
  }));
  return { id, name: `Run ${id}`, symbol: 'AAPL', equityCurve };
}

const CLOSES: BenchmarkClose[] = [
  { date: '2026-03-01', close: 500 },
  { date: '2026-03-02', close: 510 },
  { date: '2026-03-03', close: 525 },
];

describe('topRunsByReturn', () => {
  it('keeps the runs with the highest total return, best first', () => {
    const runs = [run('a', [100, 110]), run('b', [100, 130]), run('c', [100, 90])];

    expect(topRunsByReturn(runs, 2).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('returns every run when there are fewer than asked for', () => {
    const runs = [run('a', [100, 110]), run('b', [100, 130])];

    expect(topRunsByReturn(runs, 5).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('breaks a tie by id so the order is stable', () => {
    const runs = [run('b', [100, 120]), run('a', [100, 120])];

    expect(topRunsByReturn(runs, 5).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('leaves out a run with too little history to have a return', () => {
    const runs = [run('a', [100]), run('b', [0, 50]), run('c', [100, 105])];

    expect(topRunsByReturn(runs, 5).map((entry) => entry.id)).toEqual(['c']);
  });

  it('leaves out a null run whose value never moved', () => {
    const runs = [run('flat', [100_000, 100_000, 100_000]), run('a', [100, 101])];

    expect(topRunsByReturn(runs, 5).map((entry) => entry.id)).toEqual(['a']);
  });

  it('keeps a run that moved and ended where it started', () => {
    const runs = [run('round-trip', [100, 105, 100])];

    expect(topRunsByReturn(runs, 5).map((entry) => entry.id)).toEqual(['round-trip']);
  });

  it('is empty for no runs or a count of zero', () => {
    expect(topRunsByReturn([], 5)).toEqual([]);
    expect(topRunsByReturn([run('a', [100, 110])], 0)).toEqual([]);
  });
});

describe('withBenchmarkCloses', () => {
  it('replaces each point’s benchmark with the close on the same date', () => {
    const points = run('a', [100, 110, 120], [1, 2, 3]).equityCurve;

    expect(withBenchmarkCloses(points, CLOSES).map((point) => point.benchmark)).toEqual([
      500, 510, 525,
    ]);
  });

  it('leaves no benchmark on a date the closes do not cover', () => {
    const points = run('a', [100, 110, 120, 130]).equityCurve;

    expect(withBenchmarkCloses(points, CLOSES)[3]).not.toHaveProperty('benchmark');
  });
});

describe('closesCurve', () => {
  it('turns closes inside the window into a curve', () => {
    expect(closesCurve(CLOSES, '2026-03-02', '2026-03-03')).toEqual([
      { date: '2026-03-02', equity: 510 },
      { date: '2026-03-03', equity: 525 },
    ]);
  });
});

describe('buyHoldCurve', () => {
  it('averages the runs’ own buy-and-hold curves, rebased to 100', () => {
    const runs = [run('a', [1, 1], [100, 110]), run('b', [1, 1], [50, 60])];

    // a: 100 → 110 (+10%); b: 100 → 120 (+20%); equal weight: 115.
    const [first, second] = buyHoldCurve(runs).map((point) => point.equity);
    expect(first).toBe(100);
    expect(second).toBeCloseTo(115);
  });

  it('spans every run’s window, not only the dates they share', () => {
    const early = {
      equityCurve: [
        { date: '2026-03-01', equity: 1, benchmark: 100 },
        { date: '2026-03-02', equity: 1, benchmark: 110 },
      ],
    };
    const late = {
      equityCurve: [
        { date: '2026-03-03', equity: 1, benchmark: 50 },
        { date: '2026-03-04', equity: 1, benchmark: 55 },
      ],
    };

    expect(buyHoldCurve([early, late]).map((point) => point.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('averages each day’s return over the runs active that day, with no jump when one joins', () => {
    const first = {
      equityCurve: [
        { date: '2026-03-01', equity: 1, benchmark: 100 },
        { date: '2026-03-02', equity: 1, benchmark: 110 }, // +10%
        { date: '2026-03-03', equity: 1, benchmark: 121 }, // +10%
      ],
    };
    const joiner = {
      equityCurve: [
        { date: '2026-03-02', equity: 1, benchmark: 40 }, // joins: no return yet
        { date: '2026-03-03', equity: 1, benchmark: 48 }, // +20%
      ],
    };

    const curve = buyHoldCurve([first, joiner]).map((point) => point.equity);

    // 100 → 110 (first alone) → 110 × (1 + (10% + 20%) / 2) = 126.5
    expect(curve[0]).toBe(100);
    expect(curve[1]).toBeCloseTo(110);
    expect(curve[2]).toBeCloseTo(126.5);
  });

  it('is empty when no run carries a benchmark', () => {
    expect(buyHoldCurve([run('a', [100, 110])])).toEqual([]);
  });
});

describe('valuesAt', () => {
  it('reports each run’s value, return and lead over its own buy-and-hold', () => {
    const [row] = valuesAt('2026-03-02', [run('a', [100_000, 110_000], [50, 55])], 'buyHold', []);

    expect(row?.value).toBe(110_000);
    expect(row?.returnSinceStart).toBeCloseTo(0.1);
    expect(row?.benchmarkReturn).toBeCloseTo(0.1);
    expect(row?.lead).toBeCloseTo(0);
  });

  it('measures the lead against SPY from the run’s own start', () => {
    const [row] = valuesAt('2026-03-03', [run('a', [100, 110, 115])], 'spy', CLOSES);

    // SPY 500 → 525 is +5%; the run is +15%.
    expect(row?.benchmarkReturn).toBeCloseTo(0.05);
    expect(row?.lead).toBeCloseTo(0.1);
  });

  it('uses the last value on or before a date the run has no point for', () => {
    const [row] = valuesAt('2026-03-09', [run('a', [100, 110])], 'spy', CLOSES);

    expect(row?.date).toBe('2026-03-02');
    expect(row?.value).toBe(110);
  });

  it('has no values for a run that had not started by the date', () => {
    const [row] = valuesAt('2026-02-01', [run('a', [100, 110])], 'spy', CLOSES);

    expect(row?.value).toBeNull();
    expect(row?.lead).toBeNull();
  });

  it('has no lead when the benchmark has no price for the run’s start', () => {
    const [row] = valuesAt('2026-03-02', [run('a', [100, 110])], 'spy', []);

    expect(row?.value).toBe(110);
    expect(row?.lead).toBeNull();
  });
});
