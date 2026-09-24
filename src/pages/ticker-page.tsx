import { ArrowLeft, ExternalLink, Star, StarOff } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  dashboardNewsWindow,
  RecentRunsTable,
  RunBacktestDialog,
  useAllBacktests,
} from '@/features/backtests';
import { NewsList, useIndicators, useRunNews, type TickerIndicators } from '@/features/market';
import { useStrategies } from '@/features/strategies';
import { normaliseTicker, perplexityFinanceUrl, useIsWatched } from '@/features/watchlist';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

const TICKER_NEWS_LIMIT = 8;
/** RSI bands the indicators table marks as stretched. */
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;

/**
 * One ticker, opened from the dashboard watchlist.
 *
 * Gathers what the app already knows about a symbol — its last-close
 * indicators and sentiment, the strategies that trade it, their runs, and the
 * scored news from those runs' windows — with a link out to Perplexity
 * Finance for the live quote and coverage the app does not hold.
 */
export default function TickerPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = normaliseTicker(params.ticker ?? '');
  if (!ticker) return <InvalidTicker raw={params.ticker ?? ''} />;
  // Keyed so a jump from one ticker to another starts from a clean page.
  return <TickerDetail key={ticker} ticker={ticker} />;
}

function TickerDetail({ ticker }: { ticker: string }) {
  const strategiesQuery = useStrategies();
  const runsQuery = useAllBacktests();

  const activeStrategies = useMemo(
    () => (strategiesQuery.data ?? []).filter((strategy) => strategy.status === 'active'),
    [strategiesQuery.data],
  );
  const universe = useMemo(
    () => [...new Set(activeStrategies.flatMap((strategy) => strategy.universe))],
    [activeStrategies],
  );
  const tradingStrategies = activeStrategies.filter((strategy) =>
    strategy.universe.includes(ticker),
  );
  const { isWatched, toggle } = useIsWatched(ticker, universe);

  // A multi-ticker run reports its symbol as MULTI, not its tickers, so a
  // strategy's runs stand in for "runs that traded this". Labelled as such.
  const runs = useMemo(() => {
    const strategyIds = new Set(tradingStrategies.map((strategy) => strategy.id));
    return (runsQuery.data?.items ?? []).filter(
      (run) => run.symbol === ticker || strategyIds.has(run.strategyId),
    );
  }, [runsQuery.data, tradingStrategies, ticker]);

  const indicatorsQuery = useIndicators([ticker]);
  const indicators = indicatorsQuery.data?.find((row) => row.ticker === ticker);

  const completedRuns = runs.filter((run) => run.status === 'completed');
  const newsWindow = dashboardNewsWindow(completedRuns, 'max');
  const news = useRunNews(
    { tickers: [ticker], start: newsWindow?.start ?? '', end: newsWindow?.end ?? '' },
    TICKER_NEWS_LIMIT,
  );

  return (
    <>
      <Link
        to={paths.dashboard}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Dashboard
      </Link>

      <PageHeader
        title={ticker}
        description={
          tradingStrategies.length > 0
            ? `Traded by ${String(tradingStrategies.length)} active ${tradingStrategies.length === 1 ? 'strategy' : 'strategies'}.`
            : 'No active strategy trades this ticker.'
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={toggle} aria-pressed={isWatched}>
              {isWatched ? (
                <StarOff className="mr-1.5 size-4" aria-hidden />
              ) : (
                <Star className="mr-1.5 size-4" aria-hidden />
              )}
              {isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            </Button>
            {/* External, so a plain anchor in a new tab; `noreferrer` keeps the
                app's URL out of the request. */}
            <a
              href={perplexityFinanceUrl(ticker)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="mr-1.5 size-4" aria-hidden />
              Perplexity Finance
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <RunBacktestDialog initialStrategyKey={tradingStrategies[0]?.id} />
          </>
        }
      />

      <IndicatorTiles
        isLoading={indicatorsQuery.isLoading}
        isError={Boolean(indicatorsQuery.error)}
        indicators={indicators}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Strategies</CardTitle>
            <CardDescription>Active strategies whose universe includes {ticker}.</CardDescription>
          </CardHeader>
          <CardContent>
            {strategiesQuery.isError && strategiesQuery.data === undefined ? (
              <p className="py-4 text-sm text-muted-foreground">Strategies unavailable.</p>
            ) : tradingStrategies.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {strategiesQuery.isPending ? 'Loading strategies…' : 'None yet.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {tradingStrategies.map((strategy) => (
                  <li key={strategy.id}>
                    <Link
                      to={paths.libraryStrategy(strategy.id)}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
                    >
                      <span className="truncate font-medium">{strategy.name}</span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {strategy.universe.length} tickers
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">News — scored</CardTitle>
            <CardDescription>
              {newsWindow
                ? `${ticker} articles from ${newsWindow.start} to ${newsWindow.end}, the span of the runs below.`
                : 'Articles appear once a run covering this ticker has completed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {news.error ? (
              <p className="py-6 text-center text-sm text-muted-foreground">News unavailable.</p>
            ) : newsWindow ? (
              <NewsList articles={news.data ?? []} isLoading={news.isLoading} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Runs</CardTitle>
          <CardDescription>
            Runs on {ticker} alone, and runs of the strategies that trade it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runsQuery.isError && runsQuery.data === undefined ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Run history unavailable.
            </p>
          ) : (
            <div
              className="report-table-scroll"
              role="region"
              aria-label={`Runs on ${ticker} rows`}
              tabIndex={0}
            >
              <RecentRunsTable runs={runs} isLoading={runsQuery.isPending} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function IndicatorTiles({
  isLoading,
  isError,
  indicators,
}: {
  isLoading: boolean;
  isError: boolean;
  indicators: TickerIndicators | undefined;
}) {
  if (isError) {
    return <p className="text-sm text-muted-foreground">Indicators unavailable for this ticker.</p>;
  }
  if (!isLoading && !indicators) {
    return <p className="text-sm text-muted-foreground">No indicators reported for this ticker.</p>;
  }
  const rsiHint =
    indicators && indicators.rsi14 >= RSI_OVERBOUGHT
      ? 'Overbought'
      : indicators && indicators.rsi14 <= RSI_OVERSOLD
        ? 'Oversold'
        : undefined;

  return (
    <section aria-label="Indicators" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          size="dense"
          label="Last close"
          value={indicators ? formatNumber(indicators.last) : '—'}
          isLoading={isLoading}
        />
        <StatTile
          size="dense"
          label="20d momentum"
          value={
            indicators
              ? formatSigned(indicators.momentum20d, (value) => formatPercent(value, 1))
              : '—'
          }
          tone={indicators ? toneFromValue(indicators.momentum20d) : 'neutral'}
          isLoading={isLoading}
        />
        <StatTile
          size="dense"
          label="RSI 14"
          value={indicators ? formatNumber(indicators.rsi14, 1) : '—'}
          hint={rsiHint}
          isLoading={isLoading}
        />
        <StatTile
          size="dense"
          label="MACD hist."
          value={
            indicators
              ? formatSigned(indicators.macdHistogram, (value) => formatNumber(value))
              : '—'
          }
          tone={indicators ? toneFromValue(indicators.macdHistogram) : 'neutral'}
          isLoading={isLoading}
        />
        <StatTile
          size="dense"
          label="SMA 50 vs 200"
          value={indicators ? (indicators.smaRegime === 'above' ? 'Above' : 'Below') : '—'}
          tone={indicators ? (indicators.smaRegime === 'above' ? 'profit' : 'loss') : 'neutral'}
          isLoading={isLoading}
        />
        <StatTile
          size="dense"
          label="Sentiment 7d"
          value={
            indicators ? formatSigned(indicators.sentiment7d, (value) => formatNumber(value)) : '—'
          }
          tone={indicators ? toneFromValue(indicators.sentiment7d) : 'neutral'}
          hint={
            indicators
              ? `${formatSigned(indicators.sentimentDelta7d, (value) => formatNumber(value))} vs prior 7d`
              : undefined
          }
          isLoading={isLoading}
        />
      </div>
      {indicators ? (
        <p className="text-xs text-muted-foreground">At the close of {indicators.asOf}.</p>
      ) : null}
    </section>
  );
}

function InvalidTicker({ raw }: { raw: string }) {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="text-xl font-semibold">Not a ticker</h1>
      <p className="text-sm text-muted-foreground">
        &ldquo;{raw}&rdquo; is not a ticker symbol this app can look up.
      </p>
      <Link
        to={paths.dashboard}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
