import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { TickerIndicators } from '../types';

import { DivergingBar } from './sentiment-gauge';

const COLUMNS = '44px 56px 68px 56px 56px 56px minmax(0,1fr) 44px';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

function Header() {
  return (
    <div
      className="tabular grid gap-2 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
      style={{ gridTemplateColumns: COLUMNS }}
    >
      <span>Ticker</span>
      <span className="text-right">Last</span>
      <span>RSI 14</span>
      <span className="text-right">MACD H</span>
      <span>SMA</span>
      <span className="text-right">Mom 20d</span>
      <span>Sentiment 7d</span>
      <span className="text-right">Δ7d</span>
    </div>
  );
}

/**
 * RSI as a position on a 0–100 track with the 30–70 band marked.
 * The number alone needs a mental lookup; the marker does not.
 */
function RsiCell({ value }: { value: number }) {
  const marker = value >= 70 ? 'var(--loss)' : value <= 30 ? 'var(--profit)' : 'var(--foreground)';
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-1.5 w-14 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-[30%] w-[40%] bg-[var(--border-strong)]/60" />
        <span
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${String(value)}%`, background: marker }}
        />
      </div>
      <span className="tabular text-xs">{formatNumber(value, 0)}</span>
    </div>
  );
}

export function IndicatorsTable({
  rows,
  isLoading,
}: {
  rows: readonly TickerIndicators[];
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-56" />;
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No tickers in the universe.</p>
    );
  }

  return (
    <div className="min-w-[640px]">
      <Header />
      {rows.map((row) => (
        <div
          key={row.ticker}
          className="grid items-center gap-2 border-b py-2 text-xs last:border-b-0 hover:bg-muted/60"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span className="tabular font-medium">{row.ticker}</span>
          <span className="tabular text-right">{formatNumber(row.last, 2)}</span>
          <RsiCell value={row.rsi14} />
          <span className={cn('tabular text-right', toneClass[toneFromValue(row.macdHistogram)])}>
            {formatSigned(row.macdHistogram, (n) => formatNumber(n, 2))}
          </span>
          <span
            className={cn('tabular text-[11px]', row.smaRegime === 'below' && 'text-[var(--loss)]')}
          >
            {row.smaRegime === 'above' ? '50 > 200' : '50 < 200'}
          </span>
          <span className={cn('tabular text-right', toneClass[toneFromValue(row.momentum20d)])}>
            {formatSigned(row.momentum20d, (n) => formatPercent(n, 1))}
          </span>
          <div className="flex items-center gap-2">
            <DivergingBar value={row.sentiment7d} width={72} />
            <span
              className={cn('tabular w-10 text-right', toneClass[toneFromValue(row.sentiment7d)])}
            >
              {formatSigned(row.sentiment7d, (n) => n.toFixed(2))}
            </span>
          </div>
          <span
            className={cn(
              'tabular text-right text-[11px]',
              toneClass[toneFromValue(row.sentimentDelta7d)],
            )}
          >
            {formatSigned(row.sentimentDelta7d, (n) => n.toFixed(2))}
          </span>
        </div>
      ))}
    </div>
  );
}
