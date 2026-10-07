/** Public surface of the market feature. */

export { CandleChart } from './components/candle-chart';
export { IndicatorsTable } from './components/indicators-table';
export { NewsList } from './components/news-list';
export { RunNewsPanel } from './components/run-news-panel';
export { DivergingBar, SentimentGauge } from './components/sentiment-gauge';
export {
  fetchIndicators,
  fetchRunNews,
  marketKeys,
  useIndicators,
  useRunNews,
  type RunNewsWindow,
} from './market-api';
export {
  CANDLE_RANGES,
  candleWindow,
  fetchCandles,
  useCandles,
  type Candle,
  type CandleRange,
} from './candles-api';
export type { NewsArticle, TickerIndicators } from './types';
