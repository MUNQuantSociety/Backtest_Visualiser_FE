import type { ParameterSpec, Strategy, StrategyStatus } from './types';

/**
 * Demo data for the strategy catalogue, served when `VITE_USE_FIXTURES=true`.
 *
 * Only the *static* half lives here — identity, description, parameter specs.
 * The aggregates (`runCount`, `bestSharpe`, …) are computed in the api layer
 * from the real backtest list, so a strategy card can never disagree with the
 * runs it links to. Same stopgap caveat as every other fixtures module.
 *
 * `id` matches `BacktestSummary.strategyId` exactly; that join is what makes
 * "show me this strategy's runs" a filter rather than a new endpoint.
 */

interface Blueprint {
  id: string;
  name: string;
  className: string;
  description: string;
  status: StrategyStatus;
  tags: string[];
  universe: string[];
  parameters: ParameterSpec[];
}

const BLUEPRINTS: readonly Blueprint[] = [
  {
    id: 'vol-momentum',
    name: 'Volatility Momentum',
    className: 'VolMomentum',
    description:
      'Ranks the universe by volatility-scaled momentum and holds the top decile, rebalancing when the z-score decays past the exit band.',
    status: 'active',
    tags: ['momentum', 'equities', 'daily'],
    universe: ['AAPL', 'TSLA', 'AMD', 'MSFT', 'NVDA'],
    parameters: [
      { key: 'lookback', label: 'Lookback (bars)', type: 'integer', default: 20, min: 5, max: 250 },
      { key: 'entryZ', label: 'Entry z-score', type: 'number', default: 1.5, min: 0.5, max: 4 },
      { key: 'exitZ', label: 'Exit z-score', type: 'number', default: 0.4, min: 0, max: 3 },
      {
        key: 'maxPositionPct',
        label: 'Max position size',
        type: 'percent',
        default: 0.25,
        min: 0.01,
        max: 1,
      },
    ],
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    className: 'MeanReversion',
    description:
      'Fades stretched moves against a rolling mean, sized by the deviation and closed when the spread normalises or the hold limit expires.',
    status: 'active',
    tags: ['reversion', 'financials', 'intraday'],
    universe: ['JPM', 'BAC', 'GS', 'MS'],
    parameters: [
      { key: 'lookback', label: 'Lookback (bars)', type: 'integer', default: 40, min: 10, max: 400 },
      { key: 'entryZ', label: 'Entry z-score', type: 'number', default: 2, min: 0.5, max: 5 },
      { key: 'exitZ', label: 'Exit z-score', type: 'number', default: 0.25, min: 0, max: 3 },
      {
        key: 'maxHoldBars',
        label: 'Max hold (bars)',
        type: 'integer',
        default: 48,
        min: 1,
        max: 500,
      },
    ],
  },
  {
    id: 'trend-following',
    name: 'Trend Following',
    className: 'TrendFollowing',
    description:
      'Classic fast/slow crossover with an ATR-scaled trailing stop. Trades few, holds long, and expects a low win rate paid for by the tail.',
    status: 'active',
    tags: ['trend', 'index', 'daily'],
    universe: ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD'],
    parameters: [
      { key: 'fastPeriod', label: 'Fast period', type: 'integer', default: 12, min: 2, max: 100 },
      { key: 'slowPeriod', label: 'Slow period', type: 'integer', default: 26, min: 5, max: 400 },
      { key: 'atrMultiple', label: 'ATR stop multiple', type: 'number', default: 2.5, min: 0.5, max: 10 },
    ],
  },
  {
    id: 'pairs-trading',
    name: 'Pairs',
    className: 'PairsTrading',
    description:
      'Trades the spread between two cointegrated names, re-estimating the hedge ratio on a fixed cadence rather than continuously.',
    status: 'active',
    tags: ['stat-arb', 'energy', 'intraday'],
    universe: ['XOM', 'CVX', 'COP', 'SLB'],
    parameters: [
      { key: 'hedgeRatio', label: 'Hedge ratio', type: 'number', default: 1.18, min: 0.1, max: 5 },
      { key: 'entryZ', label: 'Entry z-score', type: 'number', default: 2.2, min: 0.5, max: 5 },
      {
        key: 'rebalanceDays',
        label: 'Re-estimate every (days)',
        type: 'integer',
        default: 5,
        min: 1,
        max: 90,
      },
    ],
  },
  {
    id: 'breakout',
    name: 'Breakout',
    className: 'Breakout',
    description:
      'Donchian channel breakout with a shorter exit channel, risking a fixed fraction of equity per position.',
    status: 'active',
    tags: ['breakout', 'equities', 'daily'],
    universe: ['NVDA', 'AMD', 'AVGO', 'MU'],
    parameters: [
      { key: 'channelPeriod', label: 'Entry channel', type: 'integer', default: 55, min: 5, max: 300 },
      { key: 'exitPeriod', label: 'Exit channel', type: 'integer', default: 20, min: 2, max: 200 },
      {
        key: 'riskPerTradePct',
        label: 'Risk per trade',
        type: 'percent',
        default: 0.02,
        min: 0.001,
        max: 0.2,
      },
    ],
  },
  {
    id: 'fx-carry',
    name: 'Carry',
    className: 'FxCarry',
    description:
      'Long the highest-yielding G10 legs against the lowest. Included deliberately as a strategy that has not worked in this window.',
    status: 'active',
    tags: ['carry', 'fx', 'intraday'],
    universe: ['G10'],
    parameters: [
      { key: 'rankWindow', label: 'Rank window (days)', type: 'integer', default: 90, min: 10, max: 365 },
      { key: 'longLegs', label: 'Long legs', type: 'integer', default: 3, min: 1, max: 5 },
      { key: 'shortLegs', label: 'Short legs', type: 'integer', default: 3, min: 1, max: 5 },
    ],
  },
  {
    // No runs yet — the catalogue must render a strategy that has never been
    // tested, because that is the state every new strategy starts in.
    id: 'ml-ensemble',
    name: 'ML Ensemble',
    className: 'MlEnsemble',
    description:
      'Gradient-boosted ensemble over the standard factor set. Scaffolded but not yet wired to the feature store, so it has no runs.',
    status: 'draft',
    tags: ['ml', 'research'],
    universe: ['SPY', 'QQQ'],
    parameters: [
      { key: 'trees', label: 'Trees', type: 'integer', default: 400, min: 10, max: 2000 },
      { key: 'maxDepth', label: 'Max depth', type: 'integer', default: 6, min: 1, max: 32 },
      { key: 'shrinkage', label: 'Learning rate', type: 'number', default: 0.05, min: 0.001, max: 1 },
    ],
  },
  {
    id: 'overnight-gap',
    name: 'Overnight Gap',
    className: 'OvernightGap',
    description:
      'Held overnight into the open. Retired after the borrow costs ate the edge; kept for reference.',
    status: 'archived',
    tags: ['reversion', 'retired'],
    universe: ['SPY'],
    parameters: [
      { key: 'gapThreshold', label: 'Gap threshold', type: 'percent', default: 0.015, min: 0, max: 0.2 },
    ],
  },
];

/** Static half of the catalogue; the api layer attaches run aggregates. */
export function fixtureStrategyBlueprints(): readonly Blueprint[] {
  return BLUEPRINTS;
}

/** Default parameter map for a strategy, used to prefill the run form. */
export function defaultParametersFor(strategy: Pick<Strategy, 'parameters'>) {
  return Object.fromEntries(strategy.parameters.map((spec) => [spec.key, spec.default]));
}
