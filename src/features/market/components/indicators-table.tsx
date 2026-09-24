import { InfoTip } from '@/components/ui/info-tip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { INDICATOR_TIPS } from '../indicator-tips';
import type { TickerIndicators } from '../types';

import { DivergingBar } from './sentiment-gauge';

/*
 * Sized so each heading fits its label plus the ⓘ, and each cell fits its
 * widest value on one line: RSI's track and number, "50 < 200", "-22.3%". The
 * spare width goes to sentiment, whose bar and score read better with room.
 * Together they fit the dashboard card without a sideways scroll.
 */
const COLUMNS = '48px 56px 76px 64px 60px 72px minmax(112px,1fr) 52px';
// The padding keeps the last column's values clear of the scroller's bar.
const MIN_WIDTH = 'min-w-[608px] pr-3';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/** A column heading; `tip` adds an ⓘ that explains the column. */
function HeaderCell({
  label,
  tip,
  align = 'left',
}: {
  label: string;
  tip?: string;
  align?: 'left' | 'right';
}) {
  return (
    <span
      role="columnheader"
      className={cn(
        'flex min-w-0 items-center gap-0.5 whitespace-nowrap',
        align === 'right' && 'justify-end',
      )}
    >
      {label}
      {tip ? (
        // The ⓘ names itself "About …"; the heading is the label alone.
        <span className="-my-1">
          <InfoTip label={label}>{tip}</InfoTip>
        </span>
      ) : null}
    </span>
  );
}

function Header() {
  return (
    <div
      role="row"
      className="tabular sticky top-0 z-10 grid items-center gap-2 border-b bg-card pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
      style={{ gridTemplateColumns: COLUMNS }}
    >
      <HeaderCell label="Ticker" />
      <HeaderCell label="Last" tip={INDICATOR_TIPS.last} align="right" />
      <HeaderCell label="RSI 14" tip={INDICATOR_TIPS.rsi14} />
      <HeaderCell label="MACD H" tip={INDICATOR_TIPS.macdHistogram} align="right" />
      <HeaderCell label="SMA" tip={INDICATOR_TIPS.smaRegime} />
      <HeaderCell label="Mom 20d" tip={INDICATOR_TIPS.momentum20d} align="right" />
      <HeaderCell label="Sentiment 7d" tip={INDICATOR_TIPS.sentiment7d} />
      <HeaderCell label="Δ7d" tip={INDICATOR_TIPS.sentimentDelta7d} align="right" />
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
    <div role="cell" className="flex items-center gap-1.5">
      <div className="relative h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-[30%] w-[40%] bg-[var(--border-strong)]/60" />
        <span
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${String(value)}%`, background: marker }}
        />
      </div>
      <span className="tabular w-5 shrink-0 text-right text-xs">{formatNumber(value, 0)}</span>
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
    <div role="table" aria-label="Indicators and sentiment by ticker" className={MIN_WIDTH}>
      <Header />
      {rows.map((row) => (
        <div
          key={row.ticker}
          role="row"
          className="grid items-center gap-2 border-b py-2 text-xs whitespace-nowrap last:border-b-0 hover:bg-muted/60"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span role="rowheader" className="tabular font-medium">
            {row.ticker}
          </span>
          <span role="cell" className="tabular text-right">
            {formatNumber(row.last, 2)}
          </span>
          <RsiCell value={row.rsi14} />
          <span
            role="cell"
            className={cn('tabular text-right', toneClass[toneFromValue(row.macdHistogram)])}
          >
            {formatSigned(row.macdHistogram, (n) => formatNumber(n, 2))}
          </span>
          <span
            role="cell"
            className={cn('tabular text-[11px]', row.smaRegime === 'below' && 'text-[var(--loss)]')}
          >
            {row.smaRegime === 'above' ? '50 > 200' : '50 < 200'}
          </span>
          <span
            role="cell"
            className={cn('tabular text-right', toneClass[toneFromValue(row.momentum20d)])}
          >
            {formatSigned(row.momentum20d, (n) => formatPercent(n, 1))}
          </span>
          <div role="cell" className="flex min-w-0 items-center gap-2">
            <DivergingBar value={row.sentiment7d} width={64} />
            <span
              className={cn('tabular w-10 text-right', toneClass[toneFromValue(row.sentiment7d)])}
            >
              {formatSigned(row.sentiment7d, (n) => n.toFixed(2))}
            </span>
          </div>
          <span
            role="cell"
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
