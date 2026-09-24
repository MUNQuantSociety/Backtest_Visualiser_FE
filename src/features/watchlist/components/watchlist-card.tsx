import { Loader2, Plus, RotateCcw, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { validateTickers, type UniverseRow } from '@/features/backtests';
import { useIndicators, type TickerIndicators } from '@/features/market';
import { seriesColor, type ChartPalette } from '@/lib/chart-theme';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';

import { normaliseTicker, useWatchlist } from '../watchlist-store';

const log = createLogger('watchlist');

/** Shared by the heading row and every ticker row, so the labels sit over their columns. */
const ROW_COLUMNS = '52px minmax(0,1fr) 64px 56px';

const toneClass = {
  up: 'text-[var(--profit)]',
  down: 'text-[var(--loss)]',
  flat: 'text-muted-foreground',
} as const;

interface WatchlistCardProps {
  /** The strategy universe, most-traded first; seeds the watchlist. */
  universe: readonly UniverseRow[];
  palette: ChartPalette;
  /** True until the strategies have loaded, so the empty state waits too. */
  isLoading: boolean;
  /** True when the strategy list failed and there is no universe to show. */
  isUnavailable: boolean;
  /**
   * Sizes the card from outside. The rows scroll within whatever height the
   * card is given, so a page can match it to a neighbour instead of letting a
   * long watchlist set the row's height.
   */
  className?: string | undefined;
}

/**
 * The dashboard's ticker watchlist, in the Universe card's old place.
 *
 * It starts as the tickers the active strategies trade and keeps their
 * stacked strategy bar, so what the Universe card said is still here. On top
 * of that a person can add any symbol FMP knows and remove ones they do not
 * care about; each row opens the ticker's own page.
 */
export function WatchlistCard({
  universe,
  palette,
  isLoading,
  isUnavailable,
  className,
}: WatchlistCardProps) {
  const universeTickers = universe.map((row) => row.ticker);
  const watchlist = useWatchlist(universeTickers);
  const indicators = useIndicators(watchlist.tickers);
  const indicatorsByTicker = new Map((indicators.data ?? []).map((row) => [row.ticker, row]));
  const rowByTicker = new Map(universe.map((row) => [row.ticker, row]));
  const widestUniverse = Math.max(1, ...universe.map((row) => row.strategyIndexes.length));

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-[15px]">Watchlist</CardTitle>
          <CardDescription>
            Your strategies&apos; tickers plus any you add. Segments are the strategies trading each
            one. Open a ticker for more.
          </CardDescription>
        </div>
        {watchlist.isEdited ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={watchlist.reset}
            title="Drop your additions and removals"
          >
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
            Reset
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <AddTickerForm
          existing={watchlist.tickers}
          onAdd={(ticker) => {
            watchlist.add(ticker);
          }}
        />

        {/* Only the rows scroll: the field above stays put, and the column
            headings stick to the top of the scrolled list. Focusable so a
            keyboard user can scroll it. */}
        <div
          role="region"
          aria-label="Watchlist rows"
          tabIndex={0}
          className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--muted-foreground)_transparent] overflow-y-auto overscroll-contain pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {watchlist.tickers.length > 0 ? (
            // Visual only: each row's link is named for its ticker, and the
            // remove button for what it removes.
            <div
              data-testid="watchlist-columns"
              aria-hidden
              className="sticky top-0 z-10 flex items-center gap-1 border-b bg-card pb-1.5"
            >
              <div
                className="tabular grid min-w-0 flex-1 gap-2 px-1.5 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
                style={{ gridTemplateColumns: ROW_COLUMNS }}
              >
                <span>Ticker</span>
                <span>Strategies</span>
                <span className="text-right">Last</span>
                <span className="text-right" title="Change on the last session">
                  Day
                </span>
              </div>
              {/* Holds the remove button's column. */}
              <span className="w-7 shrink-0" />
            </div>
          ) : null}

          <ul aria-label="Watchlist" className="space-y-0.5">
            {watchlist.tickers.map((ticker) => (
              <WatchlistRow
                key={ticker}
                ticker={ticker}
                strategyIndexes={rowByTicker.get(ticker)?.strategyIndexes ?? []}
                widestUniverse={widestUniverse}
                palette={palette}
                indicators={indicatorsByTicker.get(ticker)}
                onRemove={() => {
                  log.info('ticker removed from watchlist', { ticker });
                  watchlist.remove(ticker);
                }}
              />
            ))}
          </ul>
        </div>

        {!isLoading && watchlist.tickers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isUnavailable && !watchlist.isEdited
              ? 'Strategy universe unavailable. You can still add tickers above.'
              : 'No tickers on the watchlist. Add one above.'}
          </p>
        ) : null}
        {indicators.error ? (
          <p className="text-xs text-muted-foreground">Prices unavailable right now.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WatchlistRow({
  ticker,
  strategyIndexes,
  widestUniverse,
  palette,
  indicators,
  onRemove,
}: {
  ticker: string;
  strategyIndexes: readonly number[];
  widestUniverse: number;
  palette: ChartPalette;
  indicators: TickerIndicators | undefined;
  onRemove: () => void;
}) {
  const dayChange = indicators?.change1d;
  const tone = dayChange === undefined || dayChange === 0 ? 'flat' : dayChange > 0 ? 'up' : 'down';

  return (
    <li className="flex items-center gap-1">
      {/* The link and the remove button are siblings, not nested: a button
          inside a link is invalid and swallows or doubles clicks. */}
      <Link
        to={paths.tickerDetail(ticker)}
        aria-label={`Open ${ticker}`}
        className="grid min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{ gridTemplateColumns: ROW_COLUMNS }}
      >
        <span className="tabular font-medium">{ticker}</span>
        <span
          className="flex h-2.5 gap-px overflow-hidden rounded-sm"
          title={
            strategyIndexes.length === 0
              ? 'Added by you; no active strategy trades it'
              : `${String(strategyIndexes.length)} strategies trade it`
          }
        >
          {strategyIndexes.length === 0 ? (
            <span className="h-full w-full rounded-sm border border-dashed border-[var(--border-strong)]" />
          ) : (
            strategyIndexes.map((index) => (
              <span
                key={index}
                className="h-full"
                style={{
                  width: `${String(100 / widestUniverse)}%`,
                  background: seriesColor(palette, index),
                }}
              />
            ))
          )}
        </span>
        <span className="tabular text-right">
          {indicators ? formatNumber(indicators.last) : '—'}
        </span>
        <span className={cn('tabular text-right', toneClass[tone])}>
          {dayChange === undefined
            ? '—'
            : formatSigned(dayChange, (value) => formatPercent(value, 1))}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label={`Remove ${ticker} from watchlist`}
        title={`Remove ${ticker}`}
        onClick={onRemove}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </li>
  );
}

/**
 * The "Add ticker" field. Every symbol is checked with FMP before it joins, as
 * the run form does, so the watchlist never holds a typo that loads nothing.
 */
function AddTickerForm({
  existing,
  onAdd,
}: {
  existing: readonly string[];
  onAdd: (ticker: string) => void;
}) {
  const inputId = useId();
  const messageId = useId();
  const [draft, setDraft] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = normaliseTicker(draft);
    if (!ticker) {
      setMessage('Enter a ticker symbol, e.g. AAPL or BRK.B.');
      return;
    }
    if (existing.includes(ticker)) {
      setMessage(`${ticker} is already on the watchlist.`);
      return;
    }
    setIsChecking(true);
    setMessage(null);
    try {
      const result = await validateTickers([ticker]);
      if (result.unknown.includes(ticker)) {
        setMessage(`FMP does not know ${ticker}. Check the symbol.`);
        return;
      }
      log.info('ticker added to watchlist', { ticker });
      onAdd(ticker);
      setDraft('');
    } catch (error) {
      log.error('watchlist ticker check failed', { ticker, error });
      setMessage(`Could not check ${ticker} right now. Try again in a moment.`);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      noValidate
      className="space-y-1"
    >
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Add ticker to watchlist
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage(null);
          }}
          placeholder="Add ticker, e.g. NVDA"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          disabled={isChecking}
          className="tabular h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[13px] uppercase outline-none placeholder:normal-case focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" variant="outline" disabled={isChecking || !draft.trim()}>
          {isChecking ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-1.5 size-3.5" aria-hidden />
          )}
          Add
        </Button>
      </div>
      {message ? (
        <p id={messageId} role="alert" className="text-xs text-[var(--loss)]">
          {message}
        </p>
      ) : null}
    </form>
  );
}
