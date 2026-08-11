import type {
  CompositionSeries,
  CorrelationMatrix,
  EquitySamplePoint,
  Execution,
  PortfolioDetail,
  PortfolioSummary,
} from './types';

/**
 * Demo data for the MQS Master views, served when `VITE_USE_FIXTURES=true`.
 *
 * This is a stopgap, not the plan. The real answer is a Prism mock generated
 * from the OpenAPI spec, so the demo exercises the same wire format the backend
 * will serve. Until that exists, this keeps the ported views renderable —
 * confined to the `api/` layer so no component ever knows fixtures happened.
 *
 * The shapes mirror `src/portfolios/portfolio_<n>/config.json` in MQSMaster,
 * including the real ticker sets and strategy class names, so the demo does not
 * teach anyone a portfolio layout that does not exist.
 */

/**
 * xorshift32 — deterministic, so a reload does not reshuffle every number and
 * a screenshot stays reproducible. Not remotely cryptographic; it does not
 * need to be.
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

interface Blueprint {
  id: string;
  name: string;
  strategyClass: string;
  tickers: string[];
  allocationWeight: number;
  interval: number;
  lookbackDays: number;
  omsEnabled: boolean;
}

const BLUEPRINTS: readonly Blueprint[] = [
  {
    id: '1',
    name: 'Volatility Momentum',
    strategyClass: 'VolMomentum',
    tickers: ['AAPL', 'TSLA', 'AMD', 'MSFT', 'NVDA'],
    allocationWeight: 0.2,
    interval: 60,
    lookbackDays: 90,
    omsEnabled: true,
  },
  {
    id: '2',
    name: 'Mean Reversion',
    strategyClass: 'MeanReversion',
    tickers: ['JPM', 'BAC', 'GS', 'MS'],
    allocationWeight: 0.2,
    interval: 60,
    lookbackDays: 60,
    omsEnabled: true,
  },
  {
    id: '3',
    name: 'Cross-Sectional Momentum',
    strategyClass: 'CrossSectionalMomentum',
    tickers: ['XOM', 'CVX', 'COP', 'SLB'],
    allocationWeight: 0.2,
    interval: 60,
    lookbackDays: 120,
    omsEnabled: true,
  },
  {
    id: '4',
    name: 'Trend Following',
    strategyClass: 'TrendFollowing',
    tickers: ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD'],
    allocationWeight: 0.2,
    interval: 1440,
    lookbackDays: 200,
    omsEnabled: true,
  },
  {
    id: '5',
    name: 'RBP Research Blend',
    strategyClass: 'RBPBlend',
    tickers: ['META', 'GOOGL', 'AMZN', 'NFLX'],
    allocationWeight: 0.2,
    interval: 60,
    lookbackDays: 90,
    omsEnabled: false,
  },
  {
    id: '6',
    name: 'Vol-Targeted Screener',
    strategyClass: 'ScreenerPortfolio',
    tickers: ['UNH', 'JNJ', 'PFE', 'LLY', 'ABBV'],
    allocationWeight: 0,
    interval: 1440,
    lookbackDays: 250,
    omsEnabled: false,
  },
];

const STARTING_CAPITAL = 200_000;

function isoDate(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

/** Geometric random walk with a small per-portfolio drift. */
function equityWalk(id: string, days: number): EquitySamplePoint[] {
  const random = makeRandom(seedFrom(id));
  const drift = 0.0006 + (seedFrom(id) % 7) * 0.00012;
  const vol = 0.009;

  let equity = STARTING_CAPITAL;
  const points: EquitySamplePoint[] = [];

  for (let offset = days; offset >= 0; offset -= 1) {
    // Box-Muller would be more correct; the sum of two uniforms is close
    // enough for a demo curve and avoids the log(0) guard.
    const shock = (random() + random() - 1) * vol;
    equity *= 1 + drift + shock;
    points.push({ date: isoDate(offset), equity: Math.round(equity * 100) / 100 });
  }

  return points;
}

function summaryFor(blueprint: Blueprint): PortfolioSummary {
  const curve = equityWalk(blueprint.id, 180);
  const last = curve[curve.length - 1];
  const previous = curve[curve.length - 2];
  const totalValue = last?.equity ?? STARTING_CAPITAL;
  const dayPnl = totalValue - (previous?.equity ?? STARTING_CAPITAL);

  // Portfolio 6 carries a 0% capital allocation in portfolio_manager_config.json,
  // so it is configured but not trading — a real state the UI must render.
  const state = blueprint.allocationWeight === 0 ? 'stopped' : 'running';

  return {
    id: blueprint.id,
    name: blueprint.name,
    strategyClass: blueprint.strategyClass,
    state,
    tickers: blueprint.tickers,
    allocationWeight: blueprint.allocationWeight,
    totalValue,
    cash: Math.round(totalValue * 0.12 * 100) / 100,
    dayPnl: Math.round(dayPnl * 100) / 100,
    totalPnl: Math.round((totalValue - STARTING_CAPITAL) * 100) / 100,
    totalReturn: totalValue / STARTING_CAPITAL - 1,
    lastTickAt: state === 'running' ? new Date().toISOString() : null,
  };
}

export function fixturePortfolios(): PortfolioSummary[] {
  return BLUEPRINTS.map(summaryFor);
}

export function fixturePortfolio(id: string): PortfolioDetail {
  const blueprint = BLUEPRINTS.find((candidate) => candidate.id === id);
  if (!blueprint) {
    throw new Error(`No fixture portfolio with id "${id}"`);
  }

  const summary = summaryFor(blueprint);
  const random = makeRandom(seedFrom(id) + 11);
  const invested = summary.totalValue - summary.cash;
  const equalWeight = 1 / blueprint.tickers.length;

  // Jitter the weights, then normalise so they sum to 1. Without the second
  // step the positions add up to less than the invested capital and the demo
  // shows an asset breakdown that visibly does not reconcile with the cash
  // figure beside it.
  const rawWeights = blueprint.tickers.map(() => 0.75 + random() * 0.5);
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);

  const positions = blueprint.tickers.map((ticker, index) => {
    const weight = (rawWeights[index] ?? 1) / weightTotal;
    const marketValue = invested * weight;
    const lastPrice = 40 + random() * 260;
    const quantity = Math.round(marketValue / lastPrice);
    const avgPrice = lastPrice * (0.9 + random() * 0.2);

    return {
      ticker,
      quantity,
      avgPrice: Math.round(avgPrice * 100) / 100,
      lastPrice: Math.round(lastPrice * 100) / 100,
      marketValue: Math.round(quantity * lastPrice * 100) / 100,
      unrealizedPnl: Math.round(quantity * (lastPrice - avgPrice) * 100) / 100,
      weight: (quantity * lastPrice) / summary.totalValue,
    };
  });

  return {
    ...summary,
    startedAt: `${isoDate(180)}T13:30:00Z`,
    startingCapital: STARTING_CAPITAL,
    consecutiveFailures: 0,
    positions,
    config: {
      PORTFOLIO_ID: blueprint.id,
      TICKERS: blueprint.tickers,
      INTERVAL: blueprint.interval,
      LOOKBACK_DAYS: blueprint.lookbackDays,
      EXCH: 'NASDAQ',
      WEIGHTS: Object.fromEntries(blueprint.tickers.map((ticker) => [ticker, equalWeight])),
      DATA_FEEDS: ['MARKET_DATA', 'POSITIONS', 'CASH_EQUITY', 'PORT_NOTIONAL'],
      ...(blueprint.omsEnabled
        ? {
            OMS: {
              enabled: true,
              default_algo: 'TWAP' as const,
              duration_minutes: 30,
              twap_num_slices: 10,
              vwap_bucket_minutes: 15,
              vwap_lookback_days: 20,
              min_order_notional: 100,
              fallback_to_market: true,
            },
          }
        : {}),
    },
  };
}

export function fixtureEquity(id: string, days: number): EquitySamplePoint[] {
  return equityWalk(id, days);
}

export function fixtureExecutions(id: string): Execution[] {
  const blueprint = BLUEPRINTS.find((candidate) => candidate.id === id);
  if (!blueprint) return [];

  const random = makeRandom(seedFrom(id) + 23);

  return Array.from({ length: 40 }, (_unused, index) => {
    const ticker = blueprint.tickers[index % blueprint.tickers.length] ?? 'AAPL';
    const side = random() > 0.48 ? 'BUY' : 'SELL';
    const price = Math.round((40 + random() * 260) * 100) / 100;
    const quantity = Math.round(5 + random() * 200);
    const minutesAgo = index * 37 + Math.round(random() * 20);

    return {
      id: `exec-${id}-${String(index)}`,
      ticker,
      side,
      quantity,
      price,
      notional: Math.round(quantity * price * 100) / 100,
      executedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      algo: blueprint.omsEnabled ? ('TWAP' as const) : null,
      parentOrderId: blueprint.omsEnabled ? `parent-${id}-${String(Math.floor(index / 4))}` : null,
    };
  });
}

export function fixtureCorrelations(id: string): CorrelationMatrix {
  const blueprint = BLUEPRINTS.find((candidate) => candidate.id === id);
  const tickers = blueprint?.tickers ?? [];
  const random = makeRandom(seedFrom(id) + 41);

  // Build the upper triangle, then mirror it. Generating each cell independently
  // would produce an asymmetric "correlation" matrix, which is not a thing.
  const matrix = tickers.map(() => tickers.map(() => 0));
  for (let row = 0; row < tickers.length; row += 1) {
    for (let column = row; column < tickers.length; column += 1) {
      const value = row === column ? 1 : Math.round((random() * 1.4 - 0.35) * 100) / 100;
      const rowValues = matrix[row];
      const columnValues = matrix[column];
      if (rowValues) rowValues[column] = value;
      if (columnValues) columnValues[row] = value;
    }
  }

  return { tickers, matrix, lookbackDays: blueprint?.lookbackDays ?? 90 };
}

/**
 * Per-component notional over time, for the composition chart.
 *
 * Deliberately *not* minute-by-minute: a year of minute bars is ~98k points per
 * series, which is a real payload the backend should downsample before sending.
 * Generating that here would hide the problem rather than model it, so this
 * emits daily samples and reports `downsampled: true` — the same thing a
 * competent endpoint would do.
 *
 * Holdings are driven by a slow weight drift plus periodic flat-to-cash
 * stretches, so the chart shows a strategy moving in and out of the market
 * rather than five flat ribbons.
 */
export function fixtureComposition(id: string, days: number): CompositionSeries {
  const blueprint = BLUEPRINTS.find((candidate) => candidate.id === id);
  const tickers = blueprint?.tickers ?? [];
  const curve = equityWalk(id, days);
  const random = makeRandom(seedFrom(id) + 137);

  const phases = tickers.map(() => random() * Math.PI * 2);
  const timestamps: string[] = [];
  const cash: number[] = [];
  const holdings: Record<string, number[]> = Object.fromEntries(
    tickers.map((ticker) => [ticker, [] as number[]]),
  );

  curve.forEach((point, index) => {
    timestamps.push(point.date);

    // Roughly every three weeks the strategy stands down for a few days; the
    // resulting all-cash gaps are the most legible thing on the chart.
    const flat = index % 21 >= 18;

    const rawWeights = tickers.map((_ticker, position) => {
      if (flat) return 0;
      const phase = phases[position] ?? 0;
      return 0.6 + Math.sin(index / 18 + phase) * 0.35 + random() * 0.1;
    });

    const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
    // Keep 8-20% in cash even when fully deployed, so "Cash" never vanishes.
    const invested = flat ? 0 : point.equity * (0.8 + Math.sin(index / 40) * 0.06);

    let allocated = 0;
    tickers.forEach((ticker, position) => {
      const weight = weightTotal === 0 ? 0 : (rawWeights[position] ?? 0) / weightTotal;
      const value = Math.round(invested * weight * 100) / 100;
      allocated += value;
      holdings[ticker]?.push(value);
    });

    cash.push(Math.round((point.equity - allocated) * 100) / 100);
  });

  return { timestamps, cash, holdings, downsampled: true };
}
