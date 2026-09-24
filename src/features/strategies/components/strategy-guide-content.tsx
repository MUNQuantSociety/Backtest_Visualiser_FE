import { useId, type ReactNode } from 'react';

/**
 * "Writing a strategy for the visualiser", as prose.
 *
 * Adapted from the club's MQSMaster developer guide (backtest_docs/) to how
 * this app actually takes a strategy in. Where the two differ the app wins,
 * and every rule below is read from the code that enforces it: the scan in
 * `strategy_validation/scanning.py`, the generated config in `packaging.py`,
 * and the vendored engine's `StrategyContext`, `MarketData` and
 * `BasePortfolio`. The notable differences from the CLI guide — no
 * `main_backtest.py`, no hand-written `config.json`, `engine.*` imports, and a
 * `sell()` that never opens a short — are called out in their own section.
 */

const INDICATOR_EXAMPLE = `INDICATORS = {
    "rsi": ("RelativeStrengthIndex", {"period": 14}),
    "atr": ("AverageTrueRange", {"period": 14}),
}`;

const STATE_EXAMPLE = `# One value for the whole strategy.
STATE = {"bars_seen": 0}

# One value per ticker: self.entry_price["AAPL"], and so on.
PER_TICKER_STATE = {"entry_price": None}`;

const ONDATA_EXAMPLE = `def OnData(self, context: StrategyContext):
    for ticker in self.tickers:
        asset = context.Market[ticker]
        rsi = self.rsi[ticker]
        if not (asset.Exists and rsi.IsReady):
            continue

        holding = context.Portfolio.positions.get(ticker, 0)
        if rsi.Current < 30 and holding <= 0:
            context.buy(ticker)            # toward this ticker's weight
        elif rsi.Current > 70 and holding > 0:
            context.close_position(ticker) # back to flat`;

const HISTORY_EXAMPLE = `history = context.Market[ticker].History("30d")
returns = history["close_price"].pct_change().dropna()
volatility = returns.toolkit.winsorize(limits=[0.05, 0.05]).std()`;

const SECTIONS = [
  { id: 'flow', title: 'How a run works' },
  { id: 'start', title: 'Start in the editor' },
  { id: 'shape', title: 'The shape of a strategy' },
  { id: 'indicators', title: 'Indicators' },
  { id: 'state', title: 'Remembering things between bars' },
  { id: 'context', title: 'The context object' },
  { id: 'trading', title: 'Placing trades' },
  { id: 'rules', title: 'Rules the check enforces' },
  { id: 'validation', title: 'Saving and validation' },
  { id: 'running', title: 'Running it and reading results' },
  { id: 'cli', title: 'Coming from main_backtest.py' },
  { id: 'trouble', title: 'Troubleshooting' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

/** The guide's body; `starterSource` is the editor's own starter file. */
export function StrategyGuideContent({ starterSource }: { starterSource: string }) {
  // Several copies of the dialog can exist; anchors must not collide.
  const prefix = useId();
  const anchor = (id: SectionId) => `${prefix}-${id}`;

  return (
    <div className="space-y-7 text-[13px] leading-relaxed">
      <nav aria-label="Guide contents">
        <p className="mb-1.5 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          Contents
        </p>
        <ol className="grid list-decimal gap-x-6 gap-y-0.5 pl-5 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${anchor(section.id)}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id={anchor('flow')} title="How a run works">
        <p>
          A backtest is an event-driven simulation. For the window you pick, the engine loads bars
          for every ticker in the universe, then steps through them one bar at a time. On each bar
          it updates your indicators, builds a fresh <C>context</C>, calls your{' '}
          <C>OnData(self, context)</C>, and fills any orders you placed — with the slippage and
          commission you set on the run form. When the window ends, the run&apos;s equity curve,
          trades and metrics become the results page.
        </p>
      </Section>

      <Section id={anchor('start')} title="Start in the editor">
        <p>
          On <strong>Backtests</strong>, press <strong>New strategy</strong>. There are three ways
          in, and all three end up as the same single file:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Write OnData</strong> — you write only the body of <C>OnData</C> and fill in
            indicator and state rows; the class around it is generated. The easiest start.
          </li>
          <li>
            <strong>Whole file</strong> — you write the full <C>strategy.py</C>, starting from the
            template below.
          </li>
          <li>
            <strong>Upload file</strong> — load an existing <C>.py</C> into the same editor.
          </li>
        </ul>
        <p>
          You do not write a <C>config.json</C> or touch <C>main_backtest.py</C>: the app generates
          the config and runs the engine for you.
        </p>
      </Section>

      <Section id={anchor('shape')} title="The shape of a strategy">
        <p>
          One class that inherits from <C>BasePortfolio</C>, declares what it needs as class
          attributes, and implements <C>OnData</C>. This is the editor&apos;s starter file — a
          moving-average crossover that passes the compatibility check as it stands:
        </p>
        <Code label="Starter strategy">{starterSource}</Code>
        <p>
          <C>BasePortfolio</C> sets <C>self.tickers</C>, <C>self.lookback_days</C> and{' '}
          <C>self.logger</C> before the first bar. Loop over <C>self.tickers</C> rather than naming
          symbols: the universe can be changed for each run on the run form, and a hard-coded ticker
          would be traded, or missed, regardless.
        </p>
      </Section>

      <Section id={anchor('indicators')} title="Indicators">
        <p>
          Declare them in <C>INDICATORS</C> as{' '}
          <C>&quot;attribute&quot;: (&quot;ClassName&quot;, {'{parameters}'})</C>. You get one
          instance per ticker, so <C>self.rsi[&quot;AAPL&quot;]</C> is AAPL&apos;s RSI. They are
          built and warmed before your first bar.
        </p>
        <Code label="Declaring indicators">{INDICATOR_EXAMPLE}</Code>
        <p>The engine ships these classes:</p>
        <ul className="grid list-disc gap-x-6 pl-5 font-mono text-[12px] sm:grid-cols-2">
          {[
            'SimpleMovingAverage',
            'ExponentialMovingAverage',
            'DisplacedMovingAverage',
            'RelativeStrengthIndex',
            'RelativeMomentumIndex',
            'RateOfChange',
            'AverageTrueRange',
            'VWAP',
          ].map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p>
          Each has <C>.IsReady</C> — true once it has seen enough bars — and <C>.Current</C>, its
          latest value. <strong>Always check .IsReady before reading .Current.</strong> The run form
          highlights the indicators you declared; they are part of the code, so changing one means
          editing the strategy, not the run.
        </p>
      </Section>

      <Section id={anchor('state')} title="Remembering things between bars">
        <p>
          Anything that must survive from one bar to the next goes in <C>STATE</C> (one value) or{' '}
          <C>PER_TICKER_STATE</C> (one value per ticker). Each run gets its own fresh copy of the
          defaults, so nothing leaks between runs.
        </p>
        <Code label="Declaring state">{STATE_EXAMPLE}</Code>
      </Section>

      <Section id={anchor('context')} title="The context object">
        <p>
          <C>OnData</C> receives one argument, <C>context</C>, a snapshot of this bar:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <C>context.time</C> — the bar&apos;s timestamp.
          </li>
          <li>
            <C>context.Market[ticker]</C> — that ticker&apos;s bar: <C>.Exists</C>, <C>.Open</C>,{' '}
            <C>.High</C>, <C>.Low</C>, <C>.Close</C>, <C>.Volume</C>, <C>.Sentiment</C> (the
            bar&apos;s average news score, when there is one), and <C>.History(&quot;30d&quot;)</C>{' '}
            for a DataFrame of past bars. Check <C>.Exists</C> before reading prices; a halted or
            missing bar has none.
          </li>
          <li>
            <C>context.Portfolio</C> — <C>.cash</C>, <C>.total_value</C>, <C>.positions</C> (a dict
            of ticker to quantity; empty means flat) and <C>.get_asset_weight(ticker, price)</C>.
          </li>
        </ul>
        <p>
          DataFrames and Series carry a <C>.toolkit</C> accessor with <C>winsorize</C> and{' '}
          <C>gaussian_smooth</C>:
        </p>
        <Code label="Using price history">{HISTORY_EXAMPLE}</Code>
      </Section>

      <Section id={anchor('trading')} title="Placing trades">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <C>context.buy(ticker, confidence=1.0)</C> — move toward the ticker&apos;s weight,
            covering a short first. The weight is the strategy's own unless the run form sets custom
            weights; a changed universe splits equally.
          </li>
          <li>
            <C>context.sell(ticker, confidence=1.0)</C> — reduce a long toward flat.{' '}
            <strong>It never opens a short.</strong>
          </li>
          <li>
            <C>context.close_position(ticker)</C> — take a long or a short back to flat.
          </li>
          <li>
            <C>context.target_weight(ticker, weight)</C> — move to an exact share of the portfolio;
            a negative weight is a short.
          </li>
        </ul>
        <p>
          <C>confidence</C> between 0 and 1 moves only part of the way. Sizing, fills, slippage and
          commission are the engine&apos;s job; you decide direction and conviction.
        </p>
        <Code label="A complete OnData">{ONDATA_EXAMPLE}</Code>
      </Section>

      <Section id={anchor('rules')} title="Rules the check enforces">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Exactly <strong>one</strong> <C>BasePortfolio</C> subclass per file.
          </li>
          <li>
            <C>OnData(self, context)</C>, spelled exactly — capital O, capital D — and not{' '}
            <C>async</C>.
          </li>
          <li>
            Imports only from <C>engine</C>, <C>pandas</C>, <C>numpy</C>, <C>math</C>,{' '}
            <C>datetime</C>, <C>typing</C>, <C>collections</C>, <C>statistics</C> and <C>logging</C>
            .
          </li>
          <li>
            No <C>exec</C>, <C>eval</C>, <C>compile</C>, <C>open</C>, <C>input</C> or{' '}
            <C>__import__</C>, and nothing from <C>os</C>, <C>sys</C>, <C>subprocess</C>,{' '}
            <C>requests</C> and the like. A backtest reads market data and nothing else.
          </li>
          <li>Indicator names must be classes the engine ships (above).</li>
          <li>
            Don&apos;t reuse names <C>BasePortfolio</C> already owns — <C>tickers</C>, <C>logger</C>{' '}
            and so on — as <C>INDICATORS</C> or <C>STATE</C> keys.
          </li>
          <li>
            If you write your own <C>__init__</C>, call <C>super().__init__(...)</C> first; without
            it nothing is set up and the first bar fails.
          </li>
        </ul>
      </Section>

      <Section id={anchor('validation')} title="Saving and validation">
        <p>
          <strong>Check compatibility</strong> gives a fast answer, listing every problem at once
          with its line. <strong>Save strategy</strong> runs the same check, stores the file, and
          starts a short validation backtest over the most recent month of data on AAPL and MSFT.
        </p>
        <p>
          A strategy that completes validation becomes <strong>active</strong> and appears in the
          run form. One that fails stays a draft, and a notification tells you why — open its menu
          to edit it and save again.
        </p>
      </Section>

      <Section id={anchor('running')} title="Running it and reading results">
        <p>
          Press <strong>Run backtest</strong>, pick your strategy, and set the universe, weights,
          window, capital, slippage, commission and parameters for this run. The run form&apos;s own
          quick start, in this same <C>?</C> menu, walks through each field.
        </p>
        <p>
          The results page has <strong>Performance</strong> (equity, returns), <strong>Risk</strong>{' '}
          (drawdowns, volatility), <strong>Trades</strong> (P&amp;L by ticker and the full ledger),{' '}
          <strong>News</strong> and a <strong>Tearsheet</strong>. Compare runs side by side from{' '}
          <strong>Compare</strong>.
        </p>
      </Section>

      <Section id={anchor('cli')} title="Coming from main_backtest.py">
        <p>If you learned the MQSMaster command-line workflow, four things change here:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            No <C>main_backtest.py</C> or <C>portfolio_classes</C> — the app registers and runs the
            strategy.
          </li>
          <li>
            No hand-written <C>config.json</C>. The universe, window and costs come from the run
            form.
          </li>
          <li>
            Import from <C>engine.strategies...</C>, not <C>src.portfolios...</C>.
          </li>
          <li>
            Declare <C>INDICATORS</C> as a class attribute. <C>RegisterIndicatorSet</C> inside{' '}
            <C>__init__</C> still works, but you no longer need the boilerplate.
          </li>
        </ul>
      </Section>

      <Section id={anchor('trouble')} title="Troubleshooting">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>No trades.</strong> Your indicators may never have become ready: a 200-bar
            average cannot warm up in a short window. Lengthen the window or shorten the period, and
            check that your conditions can actually be met.
          </li>
          <li>
            <strong>Validation failed.</strong> Read the notification; the message names the line.
            Run <strong>Check compatibility</strong> after each fix.
          </li>
          <li>
            <strong>Shorts never happen.</strong> <C>sell()</C> only reduces longs. Use{' '}
            <C>target_weight(ticker, -weight)</C> to go short.
          </li>
          <li>
            <strong>A ticker has no data.</strong> Its dot on the run form shows red. Pick a window
            its data covers, or remove it from the universe.
          </li>
          <li>
            <strong>Logging.</strong> <C>self.logger.info(...)</C> is ready to use; there is no need
            to configure it.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-4 space-y-2.5">
      <h3 id={`${id}-heading`} className="text-[15px] font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Inline code. */
function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}

/** A code block, scrollable sideways rather than wrapped, so indentation survives. */
function Code({ label, children }: { label: string; children: string }) {
  return (
    <pre
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-md border bg-background px-3 py-2.5 font-mono text-[12px] leading-normal"
    >
      <code>{children}</code>
    </pre>
  );
}
