import { z } from 'zod';

/**
 * Market context for the dashboard: per-ticker indicators, article sentiment
 * and scored news. The endpoints are not built yet — see `market-api.ts` —
 * so these schemas are the contract the backend is being asked to meet.
 */

export const smaRegimeSchema = z.enum(['above', 'below']);

export const tickerIndicatorsSchema = z.object({
  ticker: z.string(),
  /** Last close. */
  last: z.number(),
  rsi14: z.number().min(0).max(100),
  /** MACD histogram (12/26/9), in price units. */
  macdHistogram: z.number(),
  /** Whether the 50-day SMA sits above or below the 200-day. */
  smaRegime: smaRegimeSchema,
  /** 20-day price momentum as a ratio, e.g. 0.031 for +3.1%. */
  momentum20d: z.number(),
  /** Article-weighted sentiment over 7 days, in [-1, 1]. */
  sentiment7d: z.number().min(-1).max(1),
  /** Change in the 7-day score against the prior 7 days. */
  sentimentDelta7d: z.number(),
  /** ISO date of the session these were computed at the close of. */
  asOf: z.string(),
});
export type TickerIndicators = z.infer<typeof tickerIndicatorsSchema>;

export const indicatorsResponseSchema = z.object({
  items: z.array(tickerIndicatorsSchema),
});

export const newsArticleSchema = z.object({
  id: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  headline: z.string(),
  tickers: z.array(z.string()),
  /** Model sentiment for the article, in [-1, 1]. */
  score: z.number().min(-1).max(1),
});
export type NewsArticle = z.infer<typeof newsArticleSchema>;

export const newsResponseSchema = z.object({
  items: z.array(newsArticleSchema),
});

export type NewsScope = 'universe' | 'all';
