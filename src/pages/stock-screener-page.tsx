import { Filter, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/config/env';
import {
  DetailsPanel,
  displayOrder,
  groupQuotes,
  resolveSelection,
  TrendChart,
  usePeriodCandles,
  useQuotes,
  WatchlistTable,
  type ScreenerPeriod,
} from '@/features/screener';
import { useWatchlistUniverse } from '@/features/watchlist';

/**
 * The dashboard watchlist as a market screen: every ticker's price and day
 * change, grouped Stocks / ETFs / Crypto, with the selected one's chart and
 * key numbers. Prices come from FMP through the backend and refresh every two
 * minutes. The selected ticker lives in `?ticker=`, so a view is a link.
 */
export default function StockScreenerPage() {
  const watchlist = useWatchlistUniverse();
  const quotes = useQuotes(watchlist.tickers);
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<ScreenerPeriod>('30D');

  const groups = useMemo(() => groupQuotes(quotes.data?.quotes ?? []), [quotes.data]);
  const order = useMemo(() => displayOrder(groups), [groups]);
  // Only a ticker already in the list can be selected, so the URL's value
  // needs no symbol check of its own; indices such as ^VIX must survive it.
  const wanted = (searchParams.get('ticker') ?? '').trim().toUpperCase() || null;
  const selected = resolveSelection(order, wanted);
  const quote = quotes.data?.quotes.find((row) => row.ticker === selected);
  const candles = usePeriodCandles(selected ?? '', period);

  function select(ticker: string) {
    const params = new URLSearchParams(searchParams);
    params.set('ticker', ticker);
    setSearchParams(params, { replace: true });
  }

  const updatedAt = quotes.dataUpdatedAt
    ? new Date(quotes.dataUpdatedAt).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      <PageHeader
        title="Stock Screener"
        description="Your dashboard watchlist with live FMP prices. Prices refresh every two minutes."
        actions={
          env.useFixtures || watchlist.tickers.length === 0 ? null : (
            <div className="flex items-center gap-3">
              {updatedAt ? (
                <span className="text-xs text-muted-foreground">Updated {updatedAt}</span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void quotes.refetch()}
                disabled={quotes.isFetching}
              >
                <RefreshCw
                  className={quotes.isFetching ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'}
                  aria-hidden
                />
                Refresh
              </Button>
            </div>
          )
        }
      />
      <ScreenerBody
        watchlist={watchlist}
        quotes={quotes}
        groups={groups}
        selected={selected}
        onSelect={select}
        quote={quote}
        period={period}
        onPeriodChange={setPeriod}
        candles={candles}
      />
    </>
  );
}

function ScreenerBody({
  watchlist,
  quotes,
  groups,
  selected,
  onSelect,
  quote,
  period,
  onPeriodChange,
  candles,
}: {
  watchlist: ReturnType<typeof useWatchlistUniverse>;
  quotes: ReturnType<typeof useQuotes>;
  groups: ReturnType<typeof groupQuotes>;
  selected: string | null;
  onSelect: (ticker: string) => void;
  quote: Parameters<typeof DetailsPanel>[0]['quote'];
  period: ScreenerPeriod;
  onPeriodChange: (period: ScreenerPeriod) => void;
  candles: ReturnType<typeof usePeriodCandles>;
}) {
  if (env.useFixtures) {
    return (
      <EmptyState
        icon={Filter}
        title="No market data in fixture mode"
        description="Quotes come from FMP through the backend; turn fixtures off to screen your watchlist."
      />
    );
  }
  if (watchlist.isLoading) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted/40" />;
  }
  if (watchlist.tickers.length === 0) {
    return (
      <EmptyState
        icon={Filter}
        title="Your watchlist is empty"
        description={
          watchlist.isUnavailable
            ? 'The strategy list could not be loaded, so its tickers are missing. Add tickers to the watchlist on the dashboard.'
            : 'The screener shows the watchlist from the dashboard. Add tickers there.'
        }
        action={
          <Link
            to={paths.dashboard}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Go to the dashboard
          </Link>
        }
      />
    );
  }
  if (quotes.isError && quotes.data === undefined) {
    return (
      <EmptyState
        icon={Filter}
        title="Quotes could not be loaded"
        description={quotes.error.message}
        action={
          <Button variant="outline" size="sm" onClick={() => void quotes.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Watchlist</CardTitle>
          <CardDescription>
            {String(watchlist.tickers.length)}{' '}
            {watchlist.tickers.length === 1 ? 'ticker' : 'tickers'} from the dashboard. Day change
            is against the previous close.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.data === undefined ? (
            <div className="h-48 animate-pulse rounded-md bg-muted/40" />
          ) : (
            <WatchlistTable
              groups={groups}
              selected={selected}
              onSelect={onSelect}
              missing={quotes.data.missing}
            />
          )}
          {quotes.isError && quotes.data !== undefined ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Refresh failed; showing the last prices. {quotes.error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        <TrendChart
          ticker={selected}
          period={period}
          onPeriodChange={onPeriodChange}
          candles={candles.data}
          isLoading={candles.isPending}
          error={candles.isError ? candles.error.message : null}
        />
        <DetailsPanel quote={quote} />
      </div>
    </div>
  );
}
