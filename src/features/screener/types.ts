import { z } from 'zod';

/**
 * `GET /market-data/quotes`, mirrored from the backend's `QuotesResponse`.
 * Every ratio is a ratio (-0.0142 is -1.42%); a field FMP left empty is null.
 */
export const quoteKindSchema = z.enum(['stock', 'etf', 'index', 'crypto']);
export type QuoteKind = z.infer<typeof quoteKindSchema>;

const optionalNumber = z.number().nullable();

export const quoteSchema = z.object({
  ticker: z.string(),
  name: z.string().nullable(),
  exchange: z.string().nullable(),
  kind: quoteKindSchema,
  price: z.number(),
  change: optionalNumber,
  /** Against the previous close, as a ratio. */
  changeRatio: optionalNumber,
  open: optionalNumber,
  previousClose: optionalNumber,
  dayHigh: optionalNumber,
  dayLow: optionalNumber,
  yearHigh: optionalNumber,
  yearLow: optionalNumber,
  volume: optionalNumber,
  marketCap: optionalNumber,
  average50: optionalNumber,
  average200: optionalNumber,
  /** The quote's time, ISO 8601 in UTC. */
  asOf: z.string().nullable(),
});
export type Quote = z.infer<typeof quoteSchema>;

export const quotesResponseSchema = z.object({
  quotes: z.array(quoteSchema),
  /** Tickers FMP had no quote for. */
  missing: z.array(z.string()),
});
export type QuotesResponse = z.infer<typeof quotesResponseSchema>;
