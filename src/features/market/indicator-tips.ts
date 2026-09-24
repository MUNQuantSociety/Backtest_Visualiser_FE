/**
 * What each column of the indicators table means, shown from its heading's ⓘ.
 *
 * Every definition is read from the code that computes it,
 * `src/services/technical_indicators.py` in the backend, so a tip never
 * describes a formula the server does not use. Closes are daily session closes
 * from the market-data store.
 */
export const INDICATOR_TIPS = {
  last: 'Close of the ticker’s latest session in the market data. A session close, not a live quote.',
  rsi14:
    'Relative Strength Index: Wilder’s 14-session RSI of daily closes, from 0 to 100. The shaded band is 30–70. A dot at 70 or above (red) reads as overbought, at 30 or below (green) as oversold.',
  macdHistogram:
    'MACD histogram, in price units: the MACD line (12-session EMA minus 26-session EMA of closes) minus its 9-session signal line. Above zero, upward momentum is building; below zero, it is fading.',
  smaRegime:
    'Trend regime from simple moving averages: 50 > 200 when the 50-session average is above the 200-session one, otherwise 50 < 200 (red). A tie counts as below.',
  momentum20d:
    'Return over the last 20 sessions: the latest close against the close 20 sessions before it.',
  sentiment7d:
    'News sentiment: the mean model score of the ticker’s articles in the 7 days up to its latest session close, from −1 (negative) to +1 (positive). Every article counts once; a week with no articles scores 0.',
  sentimentDelta7d:
    'Change in sentiment: this 7-day mean minus the mean of the 7 days before it. Positive means news turned more favourable.',
} as const;
