import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCompact, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { KIND_LABELS } from '../screener-model';
import type { Quote } from '../types';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: '',
} as const;

const DASH = '—';

function price(value: number | null): string {
  return value === null ? DASH : formatNumber(value);
}

/** FMP reports 0 where a figure does not apply (an index's market cap); show it as absent. */
function compact(value: number | null, prefix = ''): string {
  return value === null || value <= 0 ? DASH : `${prefix}${formatCompact(value)}`;
}

function range(low: number | null, high: number | null): string {
  return low === null || high === null ? DASH : `${formatNumber(low)} – ${formatNumber(high)}`;
}

/** "Oct 23, 4:00 PM" in the viewer's own time zone. */
function quoteTime(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Key numbers for the selected ticker, from its latest quote. */
export function DetailsPanel({ quote }: { quote: Quote | undefined }) {
  if (!quote) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Details</CardTitle>
          <CardDescription>Select a ticker to see its numbers.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const change = quote.changeRatio;
  const asOf = quoteTime(quote.asOf);
  const rows: { label: string; value: string; className?: string }[] = [
    { label: 'Price', value: price(quote.price) },
    {
      label: 'Day change',
      value:
        change === null
          ? DASH
          : `${formatSigned(change, (value) => formatPercent(value))}${
              quote.change === null
                ? ''
                : ` (${formatSigned(quote.change, (v) => formatNumber(v))})`
            }`,
      className: change === null ? '' : toneClass[toneFromValue(change)],
    },
    { label: 'Open', value: price(quote.open) },
    { label: 'Previous close', value: price(quote.previousClose) },
    { label: 'Day range', value: range(quote.dayLow, quote.dayHigh) },
    { label: '52-week range', value: range(quote.yearLow, quote.yearHigh) },
    { label: 'Volume', value: compact(quote.volume) },
    { label: 'Market cap', value: compact(quote.marketCap, '$') },
    { label: '50-day average', value: price(quote.average50) },
    { label: '200-day average', value: price(quote.average200) },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-[15px]">{quote.ticker}</CardTitle>
          <Badge variant="secondary">{KIND_LABELS[quote.kind]}</Badge>
          {quote.exchange ? <Badge variant="outline">{quote.exchange}</Badge> : null}
        </div>
        <CardDescription>
          {quote.name ?? quote.ticker}
          {asOf ? ` · Quote as of ${asOf}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 border-b py-1"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={cn('tabular text-right font-medium', row.className)}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
