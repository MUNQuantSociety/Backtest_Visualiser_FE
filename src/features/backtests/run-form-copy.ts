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
  capital:
    'Initial capital is the cash the run starts with. Slippage, in basis points, moves every fill against you; commission is charged per share. Both apply to each fill and shape the reported P&L.',
  indicators:
    'The indicators the strategy declares, highlighted among everything the engine offers. They are part of the strategy’s code, so a run cannot add or remove them — edit the strategy to change them. The sentiment gate is not yet available.',
  parameters:
    'Values the strategy exposes for tuning, shown with the defaults its author set. A changed value is marked. The run records the values used, so a result can be reproduced or re-run with a new window.',
  runName:
    'How this run appears in the runs list and in comparisons. Leave it blank to name it after the strategy and window.',
} as const;
