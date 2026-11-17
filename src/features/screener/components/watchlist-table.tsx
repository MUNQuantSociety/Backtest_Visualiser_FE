import { useId, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue, type Tone } from '@/utils/tone';

import { displayOrder, stepSelection, type QuoteGroup } from '../screener-model';
import type { Quote } from '../types';

const toneClass: Record<Tone, string> = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-muted-foreground',
};

/** Shared by the heading and every row, so labels sit over their columns. */
const ROW_COLUMNS = 'minmax(0,1fr) 88px 72px';

interface WatchlistTableProps {
  groups: readonly QuoteGroup[];
  selected: string | null;
  onSelect: (ticker: string) => void;
  /** Watchlist tickers FMP had no quote for. */
  missing: readonly string[];
}

/**
 * The watchlist as Stocks / ETFs / Indices / Crypto rows: price and change on the day.
 * Click a row, or focus the list and use the up and down arrows, to select it.
 */
export function WatchlistTable({ groups, selected, onSelect, missing }: WatchlistTableProps) {
  const baseId = useId();
  const rowId = (ticker: string) => `${baseId}-${ticker}`;
  const order = displayOrder(groups);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = stepSelection(order, selected, step);
    if (next) {
      onSelect(next);
      document.getElementById(rowId(next))?.scrollIntoView({ block: 'nearest' });
    }
  }

  return (
    <div className="space-y-2">
      <div
        aria-hidden
        className="tabular grid gap-2 px-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
        style={{ gridTemplateColumns: ROW_COLUMNS }}
      >
        <span>Symbol</span>
        <span className="text-right">Price</span>
        <span className="text-right" title="Change since the previous close">
          Day
        </span>
      </div>

      <div
        role="listbox"
        aria-label="Watchlist quotes"
        tabIndex={0}
        aria-activedescendant={selected ? rowId(selected) : undefined}
        onKeyDown={onKeyDown}
        className="space-y-3 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {groups.map((group) => (
          <div key={group.kind} role="group" aria-labelledby={`${baseId}-group-${group.kind}`}>
            <p
              id={`${baseId}-group-${group.kind}`}
              className="px-2 pb-1 text-xs font-semibold tracking-wide text-primary uppercase"
            >
              {group.label}
            </p>
            {group.quotes.map((quote) => (
              <QuoteRow
                key={quote.ticker}
                id={rowId(quote.ticker)}
                quote={quote}
                isSelected={quote.ticker === selected}
                onSelect={() => {
                  onSelect(quote.ticker);
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {missing.length > 0 ? (
        <p className="px-2 text-xs text-muted-foreground">
          No quote from FMP for {missing.join(', ')}.
        </p>
      ) : null}
    </div>
  );
}

function QuoteRow({
  id,
  quote,
  isSelected,
  onSelect,
}: {
  id: string;
  quote: Quote;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const change = quote.changeRatio;
  return (
    <div
      id={id}
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={cn(
        'tabular grid cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
      )}
      style={{ gridTemplateColumns: ROW_COLUMNS }}
    >
      <span className="min-w-0">
        <span className="font-medium">{quote.ticker}</span>
        {quote.name ? (
          <span className="block truncate text-xs text-muted-foreground">{quote.name}</span>
        ) : null}
      </span>
      <span className="text-right">{formatNumber(quote.price)}</span>
      <span
        className={cn(
          'text-right',
          change === null ? toneClass.neutral : toneClass[toneFromValue(change)],
        )}
      >
        {change === null ? '—' : formatSigned(change, (value) => formatPercent(value))}
      </span>
    </div>
  );
}
