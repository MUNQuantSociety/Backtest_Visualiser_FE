/**
 * What each section of the run form is for, as the `ⓘ` beside its label says.
 *
 * Kept apart from the form so the wording can be read and edited as prose.
 * Each entry describes what the section decides and what the form does with
 * it — not how to operate the controls, which the controls themselves show.
 */
export const RUN_FORM_TIPS = {
  strategy:
    'Only strategies that have passed validation are listed. Each card shows the tickers it trades by default and its best Sharpe across your saved runs. Changing the strategy resets the universe, window and parameters below.',
  universe:
    "The tickers this run trades. It starts as the strategy's own set; add or remove symbols to override it for this run only. Every addition is checked with FMP before it joins, and the dot on each ticker shows whether it has bars across the chosen window.",
  window:
    'The dates to simulate, bounded by the days every ticker in the universe has data for. Start defaults to one year before the last available bar. A ticker whose history begins late clamps the earliest start.',
  barInterval:
    'The length of one simulated bar, from one minute to one trading day. Indicators, fills and every strategy decision move one bar at a time, so an indicator period counts bars of this size. Intraday bars cover regular hours only (09:30–16:00 New York) and are labelled at their close.',
  weights:
    "How the run splits the book between its tickers. Default keeps the strategy's own weights, or splits equally once you change the universe. Custom sets a percentage per ticker; anything under 100% stays in cash, and more than 100% is refused because the engine does not model leverage.",
  capital:
    'Initial capital is the cash the run starts with. Slippage, in basis points, moves every fill against you; commission is charged per share. Both apply to each fill and shape the reported P&L.',
  indicators:
    'The indicators the strategy declares, highlighted among everything the engine offers. They are part of the strategy’s code, so a run cannot add or remove them — edit the strategy to change them. The sentiment gate skips new long entries while a ticker’s 7-day news score, from the live article table, is below the threshold; with no recent articles the score is neutral and nothing is skipped.',
  parameters:
    'Values the strategy exposes for tuning, shown with the defaults its author set. A changed value is marked. The run records the values used, so a result can be reproduced or re-run with a new window.',
  runName:
    'How this run appears in the runs list and in comparisons. Leave it blank to name it after the strategy and window.',
} as const;

/**
 * The quick-start guide's steps, in the order the form asks for them.
 *
 * Where `RUN_FORM_TIPS` explains one section in depth, this is the path
 * through the whole form for someone who has not run a backtest before: what
 * to do at each step and what to look for before pressing Run.
 */
export const RUN_FORM_QUICK_START = [
  {
    title: 'Pick a strategy',
    body: 'Choose one of the validated strategies. Its default tickers, window and parameters fill in below; switching strategy resets them.',
  },
  {
    title: 'Check the universe',
    body: 'Add or remove tickers for this run only. Watch the dot beside each one: green means data covers the whole window, amber only part of it, red none, and grey that coverage is not known yet. Hover a dot to read its state. Under Weights, Custom lets you set each ticker’s share of the book.',
  },
  {
    title: 'Set the window',
    body: 'Use a preset or type the dates. The bar underneath shows the chosen span against the data available; hatched stretches are where a ticker has no bars.',
  },
  {
    title: 'Set capital and costs',
    body: 'Starting cash, slippage in basis points and commission per share. Both costs apply to every fill, so keep them realistic.',
  },
  {
    title: 'Tune the parameters',
    body: 'Optional. Values start at the strategy’s defaults; a dot marks any you changed. The run records the values it used.',
  },
  {
    title: 'Name it and run',
    body: 'Give the run a name or leave it blank for one based on the strategy and window. The footer estimates the size of the run; press Run backtest to start and follow its progress.',
  },
] as const;

/** Short hints under the steps: things that help but are not part of the path. */
export const RUN_FORM_QUICK_START_HINTS = [
  'Hover or tap the ⓘ beside any section for more detail.',
  'Save as preset keeps the whole configuration in this browser; Presets re-applies it later.',
  'Run backtest stays disabled until a strategy, a covered window and verified tickers are in place — including while a ticker is being checked, or one is typed into Add ticker without Enter pressed.',
] as const;
