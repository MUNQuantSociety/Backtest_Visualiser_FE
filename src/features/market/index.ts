/** Public surface of the market feature. */

export { IndicatorsTable } from './components/indicators-table';
export { NewsList } from './components/news-list';
export { DivergingBar, SentimentGauge } from './components/sentiment-gauge';
export { fetchIndicators, fetchNews, marketKeys, useIndicators, useNews } from './market-api';
export type { NewsArticle, NewsScope, TickerIndicators } from './types';
