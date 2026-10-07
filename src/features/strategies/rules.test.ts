import { describe, expect, it } from 'vitest';

import {
  blankRules,
  compileRules,
  describeRules,
  parseRules,
  RULE_TEMPLATES,
  rulesProblems,
  type StrategyRules,
} from './rules';

const sma = (period: number) => ({
  kind: 'indicator' as const,
  indicator: 'SimpleMovingAverage' as const,
  period,
});

describe('compileRules', () => {
  it('registers each indicator once, named by kind and period', () => {
    const rules: StrategyRules = {
      ...blankRules(),
      buy: {
        match: 'all',
        conditions: [{ left: sma(20), comparison: 'crossesAbove', right: sma(50) }],
      },
      sell: {
        match: 'all',
        conditions: [{ left: sma(20), comparison: 'crossesBelow', right: sma(50) }],
      },
    };

    expect(compileRules(rules).indicators).toEqual([
      { attribute: 'sma_20', indicator: 'SimpleMovingAverage', params: { period: 20 } },
      { attribute: 'sma_50', indicator: 'SimpleMovingAverage', params: { period: 50 } },
    ]);
  });

  it('compares a crossing against the previous bar', () => {
    const { body } = compileRules(blankRules());

    expect(body).toContain(
      'buy_signal = (before is not None and before["price"] <= before["sma_50"] and now["price"] > now["sma_50"])',
    );
    expect(body).toContain('self.previous[ticker] = now');
  });

  it('joins "any" conditions with or, and writes numbers as floats', () => {
    const rules: StrategyRules = {
      ...blankRules(),
      sell: {
        match: 'any',
        conditions: [
          { left: { kind: 'price' }, comparison: 'below', right: sma(50) },
          {
            left: { kind: 'indicator', indicator: 'RelativeStrengthIndex', period: 14 },
            comparison: 'above',
            right: { kind: 'number', value: 70 },
          },
        ],
      },
    };

    expect(compileRules(rules).body).toContain(
      'sell_signal = now["price"] < now["sma_50"] or now["rsi_14"] > 70.0',
    );
  });

  it('remembers the entry price only when a stop-loss or take-profit needs it', () => {
    expect(compileRules(blankRules()).state).toEqual({ previous: {} });
    expect(compileRules(blankRules()).body).not.toContain('entry_price');

    const guarded = compileRules({ ...blankRules(), stopLossPercent: 10, takeProfitPercent: 25 });
    expect(guarded.state).toEqual({ previous: {}, entry_price: {} });
    expect(guarded.body).toContain('if now["price"] <= entry * 0.9:');
    expect(guarded.body).toContain('if now["price"] >= entry * 1.25:');
    expect(guarded.body).toContain('self.entry_price[ticker] = now["price"]');
  });

  it('never shorts: it sells only a holding and buys only into none', () => {
    const { body } = compileRules(blankRules());

    expect(body).toContain('if holding > 0 and sell_signal:');
    expect(body).toContain('elif holding <= 0 and buy_signal:');
  });

  it('compiles every template without problems', () => {
    for (const template of RULE_TEMPLATES) {
      expect(rulesProblems(template.rules), template.id).toEqual([]);
      expect(compileRules(template.rules).body).toContain('context.buy(ticker');
    }
  });
});

describe('rulesProblems', () => {
  it('names a bad period, two numbers compared, a missing rule and a bad percent', () => {
    const rules: StrategyRules = {
      buy: {
        match: 'all',
        conditions: [
          { left: sma(1), comparison: 'above', right: { kind: 'price' } },
          {
            left: { kind: 'number', value: 1 },
            comparison: 'above',
            right: { kind: 'number', value: 2 },
          },
        ],
      },
      sell: { match: 'all', conditions: [] },
      stopLossPercent: 150,
      takeProfitPercent: null,
    };

    expect(rulesProblems(rules)).toEqual([
      'Buy condition 1: a period must be a whole number of days from 2 to 250.',
      'Buy condition 2: compare at least one price or indicator, not two numbers.',
      'Add at least one sell condition.',
      'Stop-loss must be a percent between 0 and 100.',
    ]);
  });
});

it('describes the rules as sentences', () => {
  expect(describeRules({ ...blankRules(), stopLossPercent: 5 })).toEqual([
    'Buy when the price crosses above the 50-day moving average.',
    'Sell when the price crosses below the 50-day moving average.',
    'Also sell if a holding falls 5% below what it cost.',
  ]);
});

describe('parseRules', () => {
  it('reads back rules exactly as the builder saved them', () => {
    for (const template of RULE_TEMPLATES) {
      expect(parseRules(JSON.parse(JSON.stringify(template.rules)))).toEqual(template.rules);
    }
  });

  it('refuses anything that is not builder rules, so the code editor opens instead', () => {
    expect(parseRules(undefined)).toBeNull();
    expect(parseRules(null)).toBeNull();
    expect(parseRules({ buy: 'everything' })).toBeNull();
    const unknownIndicator = structuredClone(blankRules()) as unknown as {
      buy: { conditions: { right: Record<string, unknown> }[] };
    };
    unknownIndicator.buy.conditions[0]!.right = { kind: 'indicator', indicator: 'MACD', period: 9 };
    expect(parseRules(unknownIndicator)).toBeNull();
  });
});
