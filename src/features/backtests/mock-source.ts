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

const BLUEPRINTS: readonly Blueprint[] = [
  {
    id: 'bt-momentum-aapl',
    name: 'Volatility Momentum · AAPL',
    strategyId: 'vol-momentum',
    strategyName: 'VolMomentum',
    symbol: 'AAPL',
    timeframe: '1d',
    status: 'completed',
    drift: 0.00092,
    vol: 0.0083,
    benchmarkDrift: 0.00108,
    benchmarkVol: 0.0129,
    tradeCount: 194,
    parameters: { lookback: 20, entryZ: 1.5, exitZ: 0.4, maxPositionPct: 0.25, stopLossPct: 0.06 },
  },
  {
    id: 'bt-meanrev-jpm',
    name: 'Mean Reversion · JPM',
    strategyId: 'mean-reversion',
    strategyName: 'MeanReversion',
    symbol: 'JPM',
    timeframe: '1h',
    status: 'completed',
    drift: 0.00057,
    vol: 0.0061,
    benchmarkDrift: 0.00042,
    benchmarkVol: 0.0104,
    tradeCount: 312,
    parameters: { lookback: 40, entryZ: 2, exitZ: 0.25, maxHoldBars: 48 },
  },
  {
    id: 'bt-trend-spy',
    name: 'Trend Following · SPY',
    strategyId: 'trend-following',
    strategyName: 'TrendFollowing',
    symbol: 'SPY',
    timeframe: '1d',
    status: 'completed',
    drift: 0.00068,
    vol: 0.0052,
    benchmarkDrift: 0.00081,
    benchmarkVol: 0.0091,
    tradeCount: 86,
    parameters: { fastPeriod: 12, slowPeriod: 26, atrMultiple: 2.5 },
  },
  {
    id: 'bt-pairs-xle',
    name: 'Pairs · XOM / CVX',
    strategyId: 'pairs-trading',
    strategyName: 'PairsTrading',
    symbol: 'XOM',
    timeframe: '15m',
    status: 'completed',
    drift: 0.00034,
    vol: 0.0038,
    benchmarkDrift: -0.00012,
    benchmarkVol: 0.0117,
    tradeCount: 421,
    parameters: { hedgeRatio: 1.18, entryZ: 2.2, exitZ: 0.3, rebalanceDays: 5 },
  },
  {
    id: 'bt-breakout-nvda',
    name: 'Breakout · NVDA',
    strategyId: 'breakout',
    strategyName: 'Breakout',
    symbol: 'NVDA',
    timeframe: '1d',
    status: 'completed',
    drift: 0.00121,
    vol: 0.0148,
    benchmarkDrift: 0.00219,
    benchmarkVol: 0.0206,
    tradeCount: 138,
    parameters: { channelPeriod: 55, exitPeriod: 20, riskPerTradePct: 0.02 },
  },
  {
    // Mid-run, so the list shows a live status and the detail page renders a
    // partial curve rather than a dead end.
    id: 'bt-carry-fx',
    name: 'Carry · G10 FX basket',
    strategyId: 'fx-carry',
    strategyName: 'FxCarry',
    symbol: 'G10',
    timeframe: '4h',
    status: 'running',
    drift: 0.00048,
    vol: 0.0044,
    benchmarkDrift: 0.00021,
    benchmarkVol: 0.0067,
    tradeCount: 97,
    parameters: { rankWindow: 90, longLegs: 3, shortLegs: 3 },
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
  if (curve.length < 2) return [];

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

/** A running backtest is only part-way through its window. */
function dayCountFor(blueprint: Blueprint): number {
  return blueprint.status === 'running' ? 148 : 250;
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
    startDate: curve[0]?.date ?? START_DATE,
    endDate: last?.date ?? START_DATE,
    createdAt: `${curve[0]?.date ?? START_DATE}T09:30:00Z`,
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
