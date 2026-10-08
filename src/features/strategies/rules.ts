import { z } from 'zod';

import type { IndicatorSpec, StrategyDraft } from './types';

/**
 * A strategy described as plain rules, for people who do not write code.
 *
 * "Buy when the 20-day average crosses above the 50-day average; sell when it
 * crosses back below." The builder edits this shape, and `compileRules` turns
 * it into the same `OnData` fragment a coder would write, so it goes through
 * the same check, store and validation run. Nothing on the server knows the
 * difference, which is the point: there is one way a strategy runs.
 *
 * Long only. A sell rule closes a holding; it never opens a short.
 */

/**
 * The indicators offered to a non-coder, in their own words.
 *
 * These are the FMP technical indicators the engine reads through
 * `FmpIndicator` (backend `GET /market-data/fmp-indicators` lists the same
 * names). A rule-built strategy trades on FMP's numbers, and the Build chart
 * draws the same series, so what the author sees is what the backtest reads.
 *
 * `pane` says which scale a value lives on: `price` lines are in dollars like
 * the price itself, `separate` ones are on their own scale. `range` bounds a
 * value where it has bounds, so a threshold outside it can be caught early.
 */
export const RULE_INDICATORS = {
  sma: {
    short: 'SMA',
    phrase: 'moving average',
    label: 'Moving average',
    help: 'The average closing price over the last N days. Smooths out daily noise.',
    defaultPeriod: 50,
    pane: 'price',
    range: null,
  },
  ema: {
    short: 'EMA',
    phrase: 'exponential moving average',
    label: 'Exponential moving average',
    help: 'Like a moving average, but recent days count more, so it reacts faster.',
    defaultPeriod: 20,
    pane: 'price',
    range: null,
  },
  wma: {
    short: 'WMA',
    phrase: 'weighted moving average',
    label: 'Weighted moving average',
    help: 'A moving average that leans on recent days in a straight line, newest most.',
    defaultPeriod: 20,
    pane: 'price',
    range: null,
  },
  dema: {
    short: 'DEMA',
    phrase: 'double exponential moving average',
    label: 'Double exponential moving average',
    help: 'An exponential average with less lag, so it turns sooner.',
    defaultPeriod: 20,
    pane: 'price',
    range: null,
  },
  tema: {
    short: 'TEMA',
    phrase: 'triple exponential moving average',
    label: 'Triple exponential moving average',
    help: 'The quickest of the averages: least lag, but more false turns.',
    defaultPeriod: 20,
    pane: 'price',
    range: null,
  },
  rsi: {
    short: 'RSI',
    phrase: 'RSI',
    label: 'RSI (overbought / oversold)',
    help: 'A score from 0 to 100. Below 30 is often read as oversold, above 70 as overbought.',
    defaultPeriod: 14,
    pane: 'separate',
    range: [0, 100],
  },
  williams: {
    short: '%R',
    phrase: 'Williams %R',
    label: 'Williams %R (overbought / oversold)',
    help: 'From -100 to 0: where the close sits in its recent range. Above -20 is often read as overbought, below -80 as oversold.',
    defaultPeriod: 14,
    pane: 'separate',
    range: [-100, 0],
  },
  adx: {
    short: 'ADX',
    phrase: 'trend strength (ADX)',
    label: 'Trend strength (ADX)',
    help: 'From 0 to 100: how strong the trend is, whichever way it points. Above 25 is often read as a strong trend.',
    defaultPeriod: 14,
    pane: 'separate',
    range: [0, 100],
  },
  standarddeviation: {
    short: 'Std dev',
    phrase: 'volatility (standard deviation)',
    label: 'Volatility (standard deviation)',
    help: 'How far the price has been swinging around its average, in dollars.',
    defaultPeriod: 20,
    pane: 'separate',
    range: [0, null],
  },
} as const satisfies Record<
  string,
  {
    short: string;
    phrase: string;
    label: string;
    help: string;
    defaultPeriod: number;
    pane: 'price' | 'separate';
    range: readonly [number, number | null] | null;
  }
>;

export type RuleIndicator = keyof typeof RULE_INDICATORS;

export const RULE_INDICATOR_NAMES = Object.keys(RULE_INDICATORS) as RuleIndicator[];

export type Operand =
  | { kind: 'price' }
  | { kind: 'indicator'; indicator: RuleIndicator; period: number }
  | { kind: 'number'; value: number };

export const COMPARISONS = {
  crossesAbove: 'crosses above',
  crossesBelow: 'crosses below',
  above: 'is above',
  below: 'is below',
} as const;

export type Comparison = keyof typeof COMPARISONS;

export interface Condition {
  left: Operand;
  comparison: Comparison;
  right: Operand;
}

export interface RuleGroup {
  /** `all` joins the conditions with "and", `any` with "or". */
  match: 'all' | 'any';
  conditions: Condition[];
}

export interface StrategyRules {
  buy: RuleGroup;
  sell: RuleGroup;
  /** Sell once a holding is down this many percent from its entry. Null is off. */
  stopLossPercent: number | null;
  /** Sell once a holding is up this many percent from its entry. Null is off. */
  takeProfitPercent: number | null;
}

export const MAX_CONDITIONS = 5;
export const MIN_PERIOD = 2;
export const MAX_PERIOD = 250;

const sma = (period: number): Operand => ({ kind: 'indicator', indicator: 'sma', period });
const ema = (period: number): Operand => ({ kind: 'indicator', indicator: 'ema', period });
const rsi = (period: number): Operand => ({ kind: 'indicator', indicator: 'rsi', period });
const adx = (period: number): Operand => ({ kind: 'indicator', indicator: 'adx', period });
const num = (value: number): Operand => ({ kind: 'number', value });
const PRICE: Operand = { kind: 'price' };

export interface RuleTemplate {
  id: string;
  name: string;
  idea: string;
  rules: StrategyRules;
}

/** Starting points that cover the classic retail strategies. Every one is editable. */
export const RULE_TEMPLATES: readonly RuleTemplate[] = [
  {
    id: 'golden-cross',
    name: 'Trend following',
    idea: 'Ride long trends: buy when the short-term average moves above the long-term one.',
    rules: {
      buy: {
        match: 'all',
        conditions: [{ left: sma(50), comparison: 'crossesAbove', right: sma(200) }],
      },
      sell: {
        match: 'all',
        conditions: [{ left: sma(50), comparison: 'crossesBelow', right: sma(200) }],
      },
      stopLossPercent: null,
      takeProfitPercent: null,
    },
  },
  {
    id: 'buy-the-dip',
    name: 'Buy the dip',
    idea: 'Buy when RSI says the stock is oversold, sell once it has bounced back.',
    rules: {
      buy: {
        match: 'all',
        conditions: [{ left: rsi(14), comparison: 'crossesBelow', right: num(30) }],
      },
      sell: {
        match: 'all',
        conditions: [{ left: rsi(14), comparison: 'crossesAbove', right: num(70) }],
      },
      stopLossPercent: 10,
      takeProfitPercent: null,
    },
  },
  {
    id: 'momentum',
    name: 'Momentum',
    idea: 'Buy into a strong uptrend; sell when the price slips back under its average.',
    rules: {
      buy: {
        match: 'all',
        conditions: [
          { left: PRICE, comparison: 'above', right: ema(50) },
          { left: adx(14), comparison: 'above', right: num(25) },
        ],
      },
      sell: {
        match: 'any',
        conditions: [{ left: PRICE, comparison: 'crossesBelow', right: ema(50) }],
      },
      stopLossPercent: 8,
      takeProfitPercent: 25,
    },
  },
  {
    id: 'breakout',
    name: 'Price vs. average',
    idea: 'Hold while the price is above its 20-day average; get out when it falls below.',
    rules: {
      buy: {
        match: 'all',
        conditions: [{ left: PRICE, comparison: 'crossesAbove', right: sma(20) }],
      },
      sell: {
        match: 'all',
        conditions: [{ left: PRICE, comparison: 'crossesBelow', right: sma(20) }],
      },
      stopLossPercent: 5,
      takeProfitPercent: null,
    },
  },
];

export function blankRules(): StrategyRules {
  return {
    buy: {
      match: 'all',
      conditions: [{ left: PRICE, comparison: 'crossesAbove', right: sma(50) }],
    },
    sell: {
      match: 'all',
      conditions: [{ left: PRICE, comparison: 'crossesBelow', right: sma(50) }],
    },
    stopLossPercent: null,
    takeProfitPercent: null,
  };
}

/**
 * Names the builder saved before it read FMP's indicators, for the three with
 * an FMP twin. The other two it offered then (rate of change and ATR) have no
 * FMP version, so rules using them no longer parse and open as code instead.
 */
const LEGACY_INDICATORS: Readonly<Record<string, RuleIndicator>> = {
  SimpleMovingAverage: 'sma',
  ExponentialMovingAverage: 'ema',
  RelativeStrengthIndex: 'rsi',
};

const operandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('price') }),
  z.object({
    kind: z.literal('indicator'),
    indicator: z.preprocess(
      (name) => (typeof name === 'string' ? (LEGACY_INDICATORS[name] ?? name) : name),
      z.enum(RULE_INDICATOR_NAMES as [RuleIndicator, ...RuleIndicator[]]),
    ),
    period: z.number(),
  }),
  z.object({ kind: z.literal('number'), value: z.number() }),
]);

const groupSchema = z.object({
  match: z.enum(['all', 'any']),
  conditions: z.array(
    z.object({
      left: operandSchema,
      comparison: z.enum(Object.keys(COMPARISONS) as [Comparison, ...Comparison[]]),
      right: operandSchema,
    }),
  ),
});

const rulesSchema = z.object({
  buy: groupSchema,
  sell: groupSchema,
  stopLossPercent: z.number().nullable(),
  takeProfitPercent: z.number().nullable(),
});

/**
 * Rules read back from a saved strategy, or null when they are absent or not
 * a shape this builder understands (an older or hand-edited record). Null
 * sends the strategy to the code editor, which can always open it.
 */
export function parseRules(raw: unknown): StrategyRules | null {
  const parsed = rulesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** "the 50-day moving average", "the price", "30". */
export function describeOperand(operand: Operand): string {
  if (operand.kind === 'price') return 'the price';
  if (operand.kind === 'number') return String(operand.value);
  const { phrase } = RULE_INDICATORS[operand.indicator];
  return `the ${String(operand.period)}-day ${phrase}`;
}

function describeGroup(group: RuleGroup): string {
  const joiner = group.match === 'all' ? ' and ' : ' or ';
  return group.conditions
    .map(
      (condition) =>
        `${describeOperand(condition.left)} ${COMPARISONS[condition.comparison]} ${describeOperand(condition.right)}`,
    )
    .join(joiner);
}

/** The whole strategy as sentences, so the author can read back what they built. */
export function describeRules(rules: StrategyRules): string[] {
  const lines = [
    `Buy when ${describeGroup(rules.buy)}.`,
    `Sell when ${describeGroup(rules.sell)}.`,
  ];
  if (rules.stopLossPercent !== null)
    lines.push(
      `Also sell if a holding falls ${String(rules.stopLossPercent)}% below what it cost.`,
    );
  if (rules.takeProfitPercent !== null)
    lines.push(
      `Also sell if a holding rises ${String(rules.takeProfitPercent)}% above what it cost.`,
    );
  return lines;
}

/** What is wrong with these rules, in words a non-coder can act on. Empty when fine. */
export function rulesProblems(rules: StrategyRules): string[] {
  const problems: string[] = [];
  for (const [side, group] of [
    ['buy', rules.buy],
    ['sell', rules.sell],
  ] as const) {
    if (group.conditions.length === 0) problems.push(`Add at least one ${side} condition.`);
    if (group.conditions.length > MAX_CONDITIONS)
      problems.push(`Use at most ${String(MAX_CONDITIONS)} ${side} conditions.`);
    group.conditions.forEach((condition, index) => {
      const where = `${side === 'buy' ? 'Buy' : 'Sell'} condition ${String(index + 1)}`;
      for (const operand of [condition.left, condition.right]) {
        if (
          operand.kind === 'indicator' &&
          !(
            Number.isInteger(operand.period) &&
            operand.period >= MIN_PERIOD &&
            operand.period <= MAX_PERIOD
          )
        )
          problems.push(
            `${where}: a period must be a whole number of days from ${String(MIN_PERIOD)} to ${String(MAX_PERIOD)}.`,
          );
        if (operand.kind === 'number' && !Number.isFinite(operand.value))
          problems.push(`${where}: enter a number.`);
      }
      if (condition.left.kind === 'number' && condition.right.kind === 'number')
        problems.push(`${where}: compare at least one price or indicator, not two numbers.`);
      const scaleProblem = mismatchedScales(condition);
      if (scaleProblem) problems.push(`${where}: ${scaleProblem}`);
    });
  }
  for (const [label, value] of [
    ['Stop-loss', rules.stopLossPercent],
    ['Take-profit', rules.takeProfitPercent],
  ] as const) {
    if (value !== null && !(Number.isFinite(value) && value > 0 && value < 100))
      problems.push(`${label} must be a percent between 0 and 100.`);
  }
  return problems;
}

/** Which scale an operand's value is on; a number fits any. */
function scaleOf(operand: Operand): 'price' | RuleIndicator | null {
  if (operand.kind === 'number') return null;
  if (operand.kind === 'price') return 'price';
  return RULE_INDICATORS[operand.indicator].pane === 'price' ? 'price' : operand.indicator;
}

/**
 * A comparison that can never mean anything, in words: the price against the
 * RSI, or an RSI against 150. Indicators with the same bounded scale (RSI and
 * ADX both run 0 to 100) may still be compared.
 */
function mismatchedScales(condition: Condition): string | null {
  const [left, right] = [condition.left, condition.right];
  const [leftScale, rightScale] = [scaleOf(left), scaleOf(right)];
  if (leftScale && rightScale && leftScale !== rightScale) {
    const ranges = [leftScale, rightScale].map((scale) =>
      scale === 'price' ? null : JSON.stringify(RULE_INDICATORS[scale].range),
    );
    if (ranges[0] === null || ranges[1] === null || ranges[0] !== ranges[1])
      return `${describeOperand(left)} and ${describeOperand(right)} are on different scales, so comparing them means nothing. Compare each with a number instead.`;
  }
  for (const [indicator, number] of [
    [left, right],
    [right, left],
  ] as const) {
    if (indicator.kind !== 'indicator' || number.kind !== 'number') continue;
    const range = RULE_INDICATORS[indicator.indicator].range;
    if (!range || !Number.isFinite(number.value)) continue;
    const [low, high] = range;
    if (number.value < low || (high !== null && number.value > high))
      return high === null
        ? `${describeOperand(indicator)} is never below ${String(low)}, so ${String(number.value)} can never be reached.`
        : `${describeOperand(indicator)} only runs from ${String(low)} to ${String(high)}, so ${String(number.value)} can never be reached.`;
  }
  return null;
}

/** The attribute an indicator operand is read from, e.g. `sma_50`. */
function attributeOf(operand: Extract<Operand, { kind: 'indicator' }>): string {
  return `${operand.indicator}_${String(operand.period)}`;
}

/** The key an operand's value is kept under in `now` and `before`. */
function valueKey(operand: Operand): string | null {
  if (operand.kind === 'price') return 'price';
  if (operand.kind === 'indicator') return attributeOf(operand);
  return null;
}

function pythonNumber(value: number): string {
  return Number.isInteger(value) ? `${String(value)}.0` : String(value);
}

function valueAt(operand: Operand, frame: 'now' | 'before'): string {
  const key = valueKey(operand);
  return key === null
    ? pythonNumber((operand as Extract<Operand, { kind: 'number' }>).value)
    : `${frame}["${key}"]`;
}

function conditionExpression(condition: Condition): string {
  const left = valueAt(condition.left, 'now');
  const right = valueAt(condition.right, 'now');
  switch (condition.comparison) {
    case 'above':
      return `${left} > ${right}`;
    case 'below':
      return `${left} < ${right}`;
    case 'crossesAbove':
      return `(before is not None and ${valueAt(condition.left, 'before')} <= ${valueAt(condition.right, 'before')} and ${left} > ${right})`;
    case 'crossesBelow':
      return `(before is not None and ${valueAt(condition.left, 'before')} >= ${valueAt(condition.right, 'before')} and ${left} < ${right})`;
  }
}

function groupExpression(group: RuleGroup): string {
  return group.conditions.map(conditionExpression).join(group.match === 'all' ? ' and ' : ' or ');
}

/**
 * The rules as an `OnData` fragment, its indicators and its state.
 *
 * Each bar, per ticker: wait for every indicator to warm up, read today's
 * values into `now`, compare against yesterday's (`before`) for the crossing
 * rules, then buy into an empty position or sell out of a held one. The
 * entry price is remembered for the stop-loss and take-profit.
 */
export function compileRules(rules: StrategyRules): StrategyDraft {
  const operands = [rules.buy, rules.sell].flatMap((group) =>
    group.conditions.flatMap((condition) => [condition.left, condition.right]),
  );
  const indicators = new Map<string, IndicatorSpec>();
  for (const operand of operands) {
    if (operand.kind !== 'indicator') continue;
    const attribute = attributeOf(operand);
    // Read from FMP's technical-indicator API, the same series the Build
    // chart draws, rather than computed by the engine.
    indicators.set(attribute, {
      attribute,
      indicator: 'FmpIndicator',
      params: { name: operand.indicator, period: operand.period },
    });
  }
  const attributes = [...indicators.keys()].sort();
  const usesExits = rules.stopLossPercent !== null || rules.takeProfitPercent !== null;

  const lines = [
    '"""Generated by the Build tab\'s rule builder."""',
    'for ticker in self.tickers:',
    '    asset = context.Market[ticker]',
    '    if not asset.Exists:',
    '        continue',
  ];
  if (attributes.length > 0) {
    lines.push(
      `    if not (${attributes.map((attribute) => `self.${attribute}[ticker].IsReady`).join(' and ')}):`,
      '        continue',
    );
  }
  lines.push('    now = {', '        "price": asset.Close,');
  for (const attribute of attributes)
    lines.push(`        "${attribute}": self.${attribute}[ticker].Current,`);
  lines.push(
    '    }',
    '    before = self.previous.get(ticker)',
    '    self.previous[ticker] = now',
    '    holding = context.Portfolio.positions.get(ticker, 0)',
    '',
    `    sell_signal = ${groupExpression(rules.sell)}`,
  );
  if (usesExits) {
    lines.push('    entry = self.entry_price.get(ticker)', '    if holding > 0 and entry:');
    if (rules.stopLossPercent !== null)
      lines.push(
        `        if now["price"] <= entry * ${pythonNumber(1 - rules.stopLossPercent / 100)}:`,
        '            sell_signal = True',
      );
    if (rules.takeProfitPercent !== null)
      lines.push(
        `        if now["price"] >= entry * ${pythonNumber(1 + rules.takeProfitPercent / 100)}:`,
        '            sell_signal = True',
      );
  }
  lines.push(
    `    buy_signal = ${groupExpression(rules.buy)}`,
    '',
    '    if holding > 0 and sell_signal:',
    '        context.sell(ticker, confidence=1.0)',
  );
  if (usesExits) lines.push('        self.entry_price.pop(ticker, None)');
  lines.push(
    '    elif holding <= 0 and buy_signal:',
    '        context.buy(ticker, confidence=1.0)',
  );
  if (usesExits) lines.push('        self.entry_price[ticker] = now["price"]');

  return {
    body: lines.join('\n') + '\n',
    indicators: [...indicators.values()].sort((a, b) => a.attribute.localeCompare(b.attribute)),
    state: usesExits ? { previous: {}, entry_price: {} } : { previous: {} },
    filename: null,
  };
}
