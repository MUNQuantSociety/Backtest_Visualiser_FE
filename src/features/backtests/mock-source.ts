import { TRADING_DAYS_PER_YEAR } from '@/config/constants';
import {
  cagr,
  maxDrawdown,
  profitFactor,
  sharpeRatio,
  sortinoRatio,
  stdDev,
  toReturns,
  winRate,
} from '@/utils/metrics';

import type {
  BacktestDetail,
  BacktestSummary,
  EquityPoint,
  PerformanceMetrics,
  Trade,
} from './types';

/**
 * Generator for the Backtest Visualiser demo dataset.
 *
 * Build-time only. `npm run generate:mock-data` runs this and writes the result
 * to `mock-data/backtests.json` at the repo root; the app reads that file and
 * never this module, so none of the maths below reaches the browser bundle.
 *
 * Same stopgap caveat as the portfolios fixtures: the real answer is a Prism
 * mock generated from the OpenAPI spec. Until then a committed dataset keeps
 * every chart rendering on a fresh clone with no backend running.
 *
 * The numbers are *derived*, not invented. Metrics come from `@/utils/metrics`
 * run over the generated curve, and trade P&L is scaled so it reconciles with
 * the curve's net profit. A tearsheet whose Sharpe disagrees with its own
 * equity chart is worse than no tearsheet — anyone who reads both will spot it.
 *
 * Most strategies carry several runs that differ in one parameter or in the
 * universe. That is what the Library's run list and the Compare page are for,
 * and a dataset with one run per strategy would leave both with nothing to say.
 */

/**
 * xorshift32 — deterministic, so a reload does not reshuffle the demo and a
 * screenshot stays reproducible. Same generator as the portfolios fixtures.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

function seedFrom(id: string): number {
  return [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

/** Approximately standard-normal. Irwin–Hall (n=4), shifted and scaled. */
function gaussian(random: () => number): number {
  return (random() + random() + random() + random() - 2) * 1.732;
}

interface Blueprint {
  id: string;
  name: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  status: BacktestSummary['status'];
  /** When the run was submitted. Drives "last run" and the picker's order. */
  createdAt: string;
  /** Per-day drift and volatility of the strategy's equity. */
  drift: number;
  vol: number;
  /** Buy-and-hold comparison for the same window. */
  benchmarkDrift: number;
  benchmarkVol: number;
  tradeCount: number;
  parameters: Record<string, unknown>;
}

const INITIAL_CAPITAL = 1_000_000;
const START_DATE = '2023-01-03';

const VOL_MOMENTUM = {
  strategyId: 'vol-momentum',
  strategyName: 'VolMomentum',
  timeframe: '1d',
  benchmarkDrift: 0.00108,
  benchmarkVol: 0.0129,
  parameters: { lookback: 20, entryZ: 1.5, exitZ: 0.4, maxPositionPct: 0.25, stopLossPct: 0.06 },
} as const;

const MEAN_REVERSION = {
  strategyId: 'mean-reversion',
  strategyName: 'MeanReversion',
  timeframe: '1h',
  benchmarkDrift: 0.00042,
  benchmarkVol: 0.0104,
  parameters: { lookback: 40, entryZ: 2, exitZ: 0.25, maxHoldBars: 48 },
} as const;

const TREND_FOLLOWING = {
  strategyId: 'trend-following',
  strategyName: 'TrendFollowing',
  timeframe: '1d',
  benchmarkDrift: 0.00081,
  benchmarkVol: 0.0091,
  parameters: { fastPeriod: 12, slowPeriod: 26, atrMultiple: 2.5 },
} as const;

const PAIRS = {
  strategyId: 'pairs-trading',
  strategyName: 'PairsTrading',
  timeframe: '15m',
  benchmarkDrift: -0.00012,
  benchmarkVol: 0.0117,
  parameters: { hedgeRatio: 1.18, entryZ: 2.2, exitZ: 0.3, rebalanceDays: 5 },
} as const;

const BREAKOUT = {
  strategyId: 'breakout',
  strategyName: 'Breakout',
  timeframe: '1d',
  benchmarkDrift: 0.00219,
  benchmarkVol: 0.0206,
  parameters: { channelPeriod: 55, exitPeriod: 20, riskPerTradePct: 0.02 },
} as const;

const FX_CARRY = {
  strategyId: 'fx-carry',
  strategyName: 'FxCarry',
  timeframe: '4h',
  benchmarkDrift: 0.00021,
  benchmarkVol: 0.0067,
  parameters: { rankWindow: 90, longLegs: 3, shortLegs: 3 },
} as const;

const BLUEPRINTS: readonly Blueprint[] = [
  /* ---- Volatility Momentum: a lookback sweep, an entry-band variant, two universes ---- */
  {
    ...VOL_MOMENTUM,
    id: 'bt-momentum-aapl',
    name: 'Volatility Momentum · AAPL',
    symbol: 'AAPL',
    status: 'completed',
    createdAt: '2026-08-12T14:05:00Z',
    drift: 0.00092,
    vol: 0.0083,
    tradeCount: 194,
  },
  {
    ...VOL_MOMENTUM,
    id: 'bt-momentum-aapl-lb40',
    name: 'Volatility Momentum · AAPL (lb 40)',
    symbol: 'AAPL',
    status: 'completed',
    createdAt: '2026-09-01T16:40:00Z',
    drift: 0.00074,
    vol: 0.0078,
    tradeCount: 121,
    parameters: { ...VOL_MOMENTUM.parameters, lookback: 40 },
  },
  {
    ...VOL_MOMENTUM,
    id: 'bt-momentum-aapl-lb60',
    name: 'Volatility Momentum · AAPL (lb 60)',
    symbol: 'AAPL',
    status: 'completed',
    createdAt: '2026-08-27T10:12:00Z',
    drift: 0.00058,
    vol: 0.0074,
    tradeCount: 84,
    parameters: { ...VOL_MOMENTUM.parameters, lookback: 60 },
  },
  {
    ...VOL_MOMENTUM,
    id: 'bt-momentum-aapl-z2',
    name: 'Volatility Momentum · AAPL (z 2.0)',
    symbol: 'AAPL',
    status: 'completed',
    createdAt: '2026-08-30T09:50:00Z',
    drift: 0.00081,
    vol: 0.0069,
    tradeCount: 133,
    parameters: { ...VOL_MOMENTUM.parameters, entryZ: 2 },
  },
  {
    ...VOL_MOMENTUM,
    id: 'bt-momentum-msft',
    name: 'Volatility Momentum · MSFT',
    symbol: 'MSFT',
    status: 'completed',
    createdAt: '2026-08-19T15:20:00Z',
    drift: 0.00069,
    vol: 0.0072,
    benchmarkDrift: 0.00095,
    benchmarkVol: 0.0112,
    tradeCount: 176,
  },
  {
    // Raised on its first bars, so the list shows a failed status with a
    // stub of a curve and a real error message rather than a dead end.
    ...VOL_MOMENTUM,
    id: 'bt-momentum-tsla',
    name: 'Volatility Momentum · TSLA',
    symbol: 'TSLA',
    status: 'failed',
    createdAt: '2026-09-02T08:15:00Z',
    drift: 0.0006,
    vol: 0.02,
    benchmarkDrift: 0.0011,
    benchmarkVol: 0.031,
    tradeCount: 0,
  },

  /* ---- Mean Reversion: lookback and entry-band variants, a second bank ---- */
  {
    ...MEAN_REVERSION,
    id: 'bt-meanrev-jpm',
    name: 'Mean Reversion · JPM',
    symbol: 'JPM',
    status: 'completed',
    createdAt: '2026-08-14T11:00:00Z',
    drift: 0.00057,
    vol: 0.0061,
    tradeCount: 312,
  },
  {
    ...MEAN_REVERSION,
    id: 'bt-meanrev-jpm-lb20',
    name: 'Mean Reversion · JPM (lb 20)',
    symbol: 'JPM',
    status: 'completed',
    createdAt: '2026-08-29T13:30:00Z',
    drift: 0.00046,
    vol: 0.0067,
    tradeCount: 402,
    parameters: { ...MEAN_REVERSION.parameters, lookback: 20 },
  },
  {
    ...MEAN_REVERSION,
    id: 'bt-meanrev-jpm-z25',
    name: 'Mean Reversion · JPM (z 2.5)',
    symbol: 'JPM',
    status: 'completed',
    createdAt: '2026-09-01T09:05:00Z',
    drift: 0.00061,
    vol: 0.0053,
    tradeCount: 198,
    parameters: { ...MEAN_REVERSION.parameters, entryZ: 2.5 },
  },
  {
    ...MEAN_REVERSION,
    id: 'bt-meanrev-bac',
    name: 'Mean Reversion · BAC',
    symbol: 'BAC',
    status: 'completed',
    createdAt: '2026-08-22T14:45:00Z',
    drift: 0.00036,
    vol: 0.0066,
    benchmarkDrift: 0.00031,
    benchmarkVol: 0.0121,
    tradeCount: 288,
  },

  /* ---- Trend Following: a slower crossover, and the same rules on QQQ ---- */
  {
    ...TREND_FOLLOWING,
    id: 'bt-trend-spy',
    name: 'Trend Following · SPY',
    symbol: 'SPY',
    status: 'completed',
    createdAt: '2026-08-10T16:00:00Z',
    drift: 0.00068,
    vol: 0.0052,
    tradeCount: 86,
  },
  {
    ...TREND_FOLLOWING,
    id: 'bt-trend-spy-slow50',
    name: 'Trend Following · SPY (20 / 50)',
    symbol: 'SPY',
    status: 'completed',
    createdAt: '2026-08-31T17:10:00Z',
    drift: 0.00057,
    vol: 0.0048,
    tradeCount: 52,
    parameters: { ...TREND_FOLLOWING.parameters, fastPeriod: 20, slowPeriod: 50 },
  },
  {
    ...TREND_FOLLOWING,
    id: 'bt-trend-qqq',
    name: 'Trend Following · QQQ',
    symbol: 'QQQ',
    status: 'completed',
    createdAt: '2026-08-25T12:00:00Z',
    drift: 0.00086,
    vol: 0.0072,
    benchmarkDrift: 0.00112,
    benchmarkVol: 0.0128,
    tradeCount: 91,
  },

  /* ---- Pairs: a tighter entry band ---- */
  {
    ...PAIRS,
    id: 'bt-pairs-xle',
    name: 'Pairs · XOM / CVX',
    symbol: 'XOM',
    status: 'completed',
    createdAt: '2026-08-16T10:30:00Z',
    drift: 0.00034,
    vol: 0.0038,
    tradeCount: 421,
  },
  {
    ...PAIRS,
    id: 'bt-pairs-xle-z18',
    name: 'Pairs · XOM / CVX (z 1.8)',
    symbol: 'XOM',
    status: 'completed',
    createdAt: '2026-08-28T15:55:00Z',
    drift: 0.00028,
    vol: 0.0042,
    tradeCount: 512,
    parameters: { ...PAIRS.parameters, entryZ: 1.8 },
  },

  /* ---- Breakout: a shorter channel, and the same rules on AMD ---- */
  {
    ...BREAKOUT,
    id: 'bt-breakout-nvda',
    name: 'Breakout · NVDA',
    symbol: 'NVDA',
    status: 'completed',
    createdAt: '2026-08-18T09:40:00Z',
    drift: 0.00121,
    vol: 0.0148,
    tradeCount: 138,
  },
  {
    ...BREAKOUT,
    id: 'bt-breakout-nvda-ch20',
    name: 'Breakout · NVDA (ch 20)',
    symbol: 'NVDA',
    status: 'completed',
    createdAt: '2026-09-01T11:25:00Z',
    drift: 0.00093,
    vol: 0.0163,
    tradeCount: 226,
    parameters: { ...BREAKOUT.parameters, channelPeriod: 20 },
  },
  {
    ...BREAKOUT,
    id: 'bt-breakout-amd',
    name: 'Breakout · AMD',
    symbol: 'AMD',
    status: 'completed',
    createdAt: '2026-08-24T13:15:00Z',
    drift: 0.00071,
    vol: 0.0154,
    benchmarkDrift: 0.00131,
    benchmarkVol: 0.0224,
    tradeCount: 149,
  },

  /* ---- FX carry: one finished run, one still going ---- */
  {
    ...FX_CARRY,
    id: 'bt-carry-fx-rank60',
    name: 'Carry · G10 FX basket (rank 60)',
    symbol: 'G10',
    status: 'completed',
    createdAt: '2026-08-21T10:00:00Z',
    drift: 0.0004,
    vol: 0.0046,
    tradeCount: 160,
    parameters: { ...FX_CARRY.parameters, rankWindow: 60 },
  },
  {
    // Mid-run, so the list shows a live status and the detail page renders a
    // partial curve rather than a dead end.
    ...FX_CARRY,
    id: 'bt-carry-fx',
    name: 'Carry · G10 FX basket',
    symbol: 'G10',
    status: 'running',
    createdAt: '2026-09-02T13:00:00Z',
    drift: 0.00048,
    vol: 0.0044,
    tradeCount: 97,
  },
];

/** Weekday dates from `START_DATE`, so the axis has no weekend gaps to explain. */
function tradingDays(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${START_DATE}T00:00:00Z`);

  while (dates.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Strategy equity plus a buy-and-hold benchmark on the same dates.
 *
 * The benchmark is deliberately the higher-drift, higher-vol series for most
 * blueprints: a demo where the strategy always wins is the one thing a quant
 * reader will not believe.
 */
function equityCurve(blueprint: Blueprint, dayCount: number): EquityPoint[] {
  const random = makeRandom(seedFrom(blueprint.id));
  const dates = tradingDays(dayCount);

  let equity = INITIAL_CAPITAL;
  let benchmark = INITIAL_CAPITAL;

  return dates.map((date) => {
    equity *= 1 + blueprint.drift + gaussian(random) * blueprint.vol;
    benchmark *= 1 + blueprint.benchmarkDrift + gaussian(random) * blueprint.benchmarkVol;

    return {
      date,
      equity: Math.round(equity * 100) / 100,
      benchmark: Math.round(benchmark * 100) / 100,
    };
  });
}

/**
 * Round-trip trades whose P&L sums to the curve's net profit.
 *
 * The raw draw is a mixture: mostly small outcomes with a fat right tail, which
 * is what a real trend-following P&L distribution looks like and what makes the
 * histogram worth plotting. Scaling to the realised net profit at the end is
 * what keeps the trade table honest against the equity chart.
 */
function trades(blueprint: Blueprint, curve: readonly EquityPoint[]): Trade[] {
  if (curve.length < 2 || blueprint.tradeCount === 0) return [];

  const random = makeRandom(seedFrom(blueprint.id) + 977);
  const netProfit = (curve[curve.length - 1]?.equity ?? 0) - INITIAL_CAPITAL;

  const raw = Array.from({ length: blueprint.tradeCount }, () => {
    // ~55% winners; losers are tighter than winners, giving payoff ratio > 1.
    const isWin = random() < 0.55;
    const tail = random() < 0.08 ? 3.4 : 1;
    const magnitude = Math.abs(gaussian(random)) * (isWin ? 5_200 : 3_900) * tail;
    return isWin ? magnitude : -magnitude;
  });

  const rawSum = raw.reduce((sum, value) => sum + value, 0);
  // Guard the degenerate case; a near-zero sum would blow the scale factor up.
  const scale = Math.abs(rawSum) < 1 ? 1 : netProfit / rawSum;

  return raw.map((rawPnl, index) => {
    const entryIndex = Math.floor((index / blueprint.tradeCount) * (curve.length - 2));
    const holdDays = 1 + Math.floor(random() * 9);
    const exitIndex = Math.min(entryIndex + holdDays, curve.length - 1);

    const pnl = Math.round(rawPnl * scale * 100) / 100;
    const entryPrice = Math.round((60 + random() * 280) * 100) / 100;
    const quantity = 50 + Math.floor(random() * 450);
    const side = random() < 0.78 ? 'long' : 'short';
    const notional = entryPrice * quantity;
    const exitPrice =
      Math.round((entryPrice + (side === 'long' ? pnl : -pnl) / quantity) * 100) / 100;

    return {
      id: `${blueprint.id}-t${String(index + 1)}`,
      symbol: blueprint.symbol,
      side,
      entryDate: curve[entryIndex]?.date ?? START_DATE,
      exitDate: curve[exitIndex]?.date ?? null,
      entryPrice,
      exitPrice,
      quantity,
      pnl,
      returnPct: notional === 0 ? 0 : pnl / notional,
      fees: Math.round(notional * 0.0002 * 100) / 100,
    };
  });
}

function metricsFor(curve: readonly EquityPoint[], closed: readonly Trade[]): PerformanceMetrics {
  const equity = curve.map((point) => point.equity);
  const returns = toReturns(equity);
  const pnls = closed.map((trade) => trade.pnl);
  const start = equity[0] ?? INITIAL_CAPITAL;
  const end = equity[equity.length - 1] ?? INITIAL_CAPITAL;

  return {
    totalReturn: start === 0 ? 0 : end / start - 1,
    cagr: cagr(equity),
    sharpe: sharpeRatio(returns),
    sortino: sortinoRatio(returns),
    maxDrawdown: maxDrawdown(equity),
    volatility: stdDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR),
    winRate: winRate(pnls),
    profitFactor: profitFactor(pnls),
    totalTrades: closed.length,
  };
}

/** A running backtest is only part-way through its window; a failed one barely started. */
const RUNNING_DAYS = 148;
const FAILED_DAYS = 23;
const FULL_DAYS = 250;

function dayCountFor(blueprint: Blueprint): number {
  switch (blueprint.status) {
    case 'running':
      return RUNNING_DAYS;
    case 'failed':
      return FAILED_DAYS;
    case 'queued':
      return 2;
    case 'completed':
      return FULL_DAYS;
  }
}

/**
 * Progress consistent with the curve the same blueprint produces.
 *
 * Derived rather than picked, so a running demo run cannot claim 80% while its
 * equity curve stops at 59% of the window.
 */
function progressFor(blueprint: Blueprint): number | null {
  switch (blueprint.status) {
    case 'completed':
      return 100;
    case 'running':
      return Math.round((RUNNING_DAYS / FULL_DAYS) * 100);
    case 'queued':
      return 0;
    // A failed run stopped somewhere unknown; claiming a figure would invent one.
    case 'failed':
      return null;
  }
}

function errorMessageFor(blueprint: Blueprint): string | null {
  return blueprint.status === 'failed'
    ? 'Strategy raised on bar 23: KeyError on ticker not present in the loaded window.'
    : null;
}

function detailFor(blueprint: Blueprint): BacktestDetail {
  const curve = equityCurve(blueprint, dayCountFor(blueprint));
  const closed = trades(blueprint, curve);
  const metrics = metricsFor(curve, closed);
  const last = curve[curve.length - 1];

  return {
    id: blueprint.id,
    name: blueprint.name,
    strategyId: blueprint.strategyId,
    strategyName: blueprint.strategyName,
    symbol: blueprint.symbol,
    timeframe: blueprint.timeframe,
    status: blueprint.status,
    progressPct: progressFor(blueprint),
    errorMessage: errorMessageFor(blueprint),
    startDate: curve[0]?.date ?? START_DATE,
    endDate: last?.date ?? START_DATE,
    createdAt: blueprint.createdAt,
    initialCapital: INITIAL_CAPITAL,
    finalEquity: last?.equity ?? INITIAL_CAPITAL,
    totalReturn: metrics.totalReturn,
    sharpe: metrics.sharpe,
    maxDrawdown: metrics.maxDrawdown,
    metrics,
    equityCurve: curve,
    trades: closed,
    parameters: blueprint.parameters,
  };
}

/**
 * Every backtest, fully expanded.
 *
 * Consumed only by `tools/generate-mock-data.ts`, which serialises the result
 * to `mock-data/backtests.json`. Nothing in `src/` imports this at runtime — the
 * app reads the committed JSON instead, so none of the generation code above
 * ships in the browser bundle.
 */
export function buildMockBacktests(): BacktestDetail[] {
  return BLUEPRINTS.map((blueprint) => detailFor(blueprint));
}
