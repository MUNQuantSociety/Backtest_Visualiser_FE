import { z } from 'zod';

import { formatNumber } from '@/utils/format';

import type { BacktestDetail } from './types';

const gateSchema = z.object({
  enabled: z.literal(true),
  threshold: z.number(),
  blockedEntryCount: z.number().int().nonnegative(),
  coverage: z.record(
    z.string(),
    z.object({
      articleCount: z.number().int().nonnegative(),
      firstAvailable: z.string().nullable(),
    }),
  ),
});

/**
 * What the sentiment gate did in a completed run, and how much news it had.
 *
 * Coverage is the point: live article history is short and patchy, so a gate
 * over an old window usually sees no news, scores neutral and blocks nothing.
 * Without saying so, "gate on" would look like it had been tested.
 */
export function SentimentGateSummary({ run }: { run: BacktestDetail }) {
  if (run.status !== 'completed') return null;
  const parsed = gateSchema.safeParse(run.reportMetadata?.['sentimentGate']);
  if (!parsed.success) return null;
  const gate = parsed.data;
  const tickers = Object.entries(gate.coverage);
  const withoutNews = tickers.filter(([, value]) => value.articleCount === 0).map(([t]) => t);

  return (
    <div className="rounded-md border bg-card px-4 py-3 text-sm">
      <p>
        <span className="font-medium">Sentiment gate</span> at{' '}
        <span className="tabular">{formatNumber(gate.threshold, 2)}</span> blocked{' '}
        <span className="tabular">{formatNumber(gate.blockedEntryCount, 0)}</span> long{' '}
        {gate.blockedEntryCount === 1 ? 'entry' : 'entries'}.
      </p>
      <p className="mt-1 text-muted-foreground">
        News available:{' '}
        {tickers
          .map(([ticker, value]) =>
            value.firstAvailable
              ? `${ticker} ${formatNumber(value.articleCount, 0)} articles from ${value.firstAvailable.slice(0, 10)}`
              : `${ticker} none`,
          )
          .join(' · ')}
        .
        {withoutNews.length > 0
          ? ' With no recent articles a ticker scores neutral, so the gate never blocked it.'
          : ''}
      </p>
    </div>
  );
}
