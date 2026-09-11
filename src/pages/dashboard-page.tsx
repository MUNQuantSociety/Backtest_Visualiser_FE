import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { Sparkline } from '@/components/charts/sparkline';
import { DemoBadge } from '@/components/common/demo-badge';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import {
  alphaRows,
  benchmarkCurve,
  bestRunByStrategy,
  bookCurve,
  dashboardEndDate,
  RecentRunsTable,
  returnCorrelation,
  RunBacktestDialog,
  summariseBook,
  universeRows,
  useBacktestEquities,
  useBacktests,
  type BookStrategy,
} from '@/features/backtests';
import {
  IndicatorsTable,
  NewsList,
  SentimentGauge,
  useIndicators,
  useNews,
  type NewsScope,
} from '@/features/market';
import { ComparisonChart, RiskReturnScatter, type ComparisonSeries } from '@/features/performance';
import { useStrategies } from '@/features/strategies';
import { seriesColor } from '@/lib/chart-theme';
import { useDashboardPeriod, useSetDashboardPeriod, type DashboardPeriod } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';
import { useChartPalette } from '@/utils/use-chart-palette';

const PERIODS = [
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
  { value: '5y', label: '5Y' },
  { value: 'max', label: 'Max' },
] as const satisfies readonly { value: DashboardPeriod; label: string }[];

const NEWS_SCOPES = [
  { value: 'universe', label: 'Universe' },
  { value: 'all', label: 'All' },
] as const satisfies readonly { value: NewsScope; label: string }[];

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/**
 * The book: every active strategy's best run, equal-weight, against SPY.
 *
 * The earlier dashboard answered "how did the last few runs go". This answers
 * the question a book has — are these one bet or five, what does the whole
 * earn over doing nothing, and what is it costing in drawdown — which is what
 * anyone allocating across strategies needs before the run-level pages.
 *
 * Every number is derived from backend-windowed equity per active strategy,
 * so the page never fans out into a request per run. The
 * maths lives in `features/backtests/book.ts`, where it can be tested.
 */
export default function DashboardPage() {
  const period = useDashboardPeriod();
  const setPeriod = useSetDashboardPeriod();
  const palette = useChartPalette();

  const strategiesQuery = useStrategies();
  const runsQuery = useBacktests();
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);

  const strategies = useMemo<BookStrategy[]>(
    () =>
      (strategiesQuery.data ?? [])
        .filter((strategy) => strategy.status === 'active')
        .map((strategy, index) => ({
          id: strategy.id,
          name: strategy.name,
          shortName: strategy.className,
          universe: strategy.universe,
          colorIndex: index,
        })),
    [strategiesQuery.data],
  );

  const bestRuns = useMemo(() => bestRunByStrategy(runs), [runs]);
  const selectedRuns = useMemo(
    () => strategies.flatMap((strategy) => bestRuns.get(strategy.id) ?? []),
    [strategies, bestRuns],
  );
  const bestIds = selectedRuns.map((run) => run.id);
  const endDate = dashboardEndDate(selectedRuns) ?? '';
  const detailsQuery = useBacktestEquities(endDate ? bestIds : [], { period, endDate });

  const model = useMemo(() => {
    const byStrategy = new Map(
      detailsQuery.data
        .filter((detail) => detail.equityCurve.length > 0)
        .map((detail) => [detail.strategyId, detail] as const),
    );
    const lines: ComparisonSeries[] = strategies.flatMap((strategy) => {
      const detail = byStrategy.get(strategy.id);
      return detail
        ? [
            {
              id: strategy.id,
              title: strategy.shortName,
              points: detail.equityCurve,
              colorIndex: strategy.colorIndex,
            },
          ]
        : [];
    });
    const book = bookCurve(lines.map((line) => line.points));
    const benchmark = benchmarkCurve([...byStrategy.values()]);
    // The backend has already applied the shared calendar window.
    const rows = alphaRows(strategies, byStrategy, 'max');
    const corr = returnCorrelation(strategies, byStrategy, 'max');
    const summary = summariseBook(
      book,
      benchmark.points,
      rows,
      corr.averagePairwise,
      strategies,
      runs,
    );
    return {
      lines,
      benchmark,
      rows,
      corr,
      summary,
      hasBook: book.length > 2,
      universe: universeRows(strategies, runs),
    };
  }, [detailsQuery.data, strategies, runs]);

  const universeTickers = useMemo(() => model.universe.map((row) => row.ticker), [model.universe]);
  const indicators = useIndicators(universeTickers);
  const [newsScope, setNewsScope] = useState<NewsScope>('universe');
  const news = useNews(universeTickers, newsScope);

  const bookSentiment = useMemo(() => {
    const rows = indicators.data ?? [];
    if (rows.length === 0) return 0;
    return rows.reduce((sum, row) => sum + row.sentiment7d, 0) / rows.length;
  }, [indicators.data]);

  const strategiesUnavailable = strategiesQuery.isError && strategiesQuery.data === undefined;
  const runsUnavailable = runsQuery.isError && runsQuery.data === undefined;
  const bookUnavailable = strategiesUnavailable || runsUnavailable || Boolean(detailsQuery.error);
  const loadingBook =
    !bookUnavailable &&
    (strategiesQuery.isPending ||
      runsQuery.isPending ||
      (bestIds.length > 0 && detailsQuery.isPending));
  const { summary } = model;
  const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? '';
  const first = model.lines.flatMap((line) => line.points[0]?.date ?? []).sort()[0];
  const last = model.lines
    .flatMap((line) => line.points.at(-1)?.date ?? [])
    .sort()
    .at(-1);
  const requestedStart = detailsQuery.data[0]?.window.requestedStart;
  const limitedHistory = detailsQuery.data.some(
    ({ window }) =>
      requestedStart && (!window.availableStart || window.availableStart > requestedStart),
  );
  const strategyIndex = new Map(strategies.map((strategy) => [strategy.id, strategy.colorIndex]));
  const widestUniverse = model.universe[0]?.strategyIndexes.length ?? 1;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          strategies.length > 0 && first && last
            ? `${String(strategies.length)} active strategies; ${String(model.lines.length)} with observations in this window, against ${model.benchmark.title} buy & hold.`
            : 'Every active strategy as an equal-weight book, against buy & hold.'
        }
        actions={
          <>
            <Segmented
              value={period}
              options={PERIODS}
              onChange={setPeriod}
              ariaLabel="Lookback period"
            />
            <RunBacktestDialog />
          </>
        }
      />

      {[
        { label: 'strategies', query: strategiesQuery },
        { label: 'run history', query: runsQuery },
      ].map(({ label, query }) =>
        query.error ? (
          <div
            key={label}
            role="alert"
            className="flex items-center gap-3 text-sm text-destructive"
          >
            <span>
              Could not {query.data === undefined ? 'load' : 'refresh'} {label}:{' '}
              {query.error.message}
              {query.data !== undefined ? ' Showing previously loaded data.' : ''}
            </span>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => {
                void query.refetch();
              }}
            >
              Retry {label}
            </Button>
          </div>
        ) : null,
      )}

      <p role="status" className="text-xs text-muted-foreground">
        {bookUnavailable
          ? `${periodLabel} book metrics are unavailable until the missing data can be loaded.`
          : loadingBook
            ? `Loading ${periodLabel} history…`
            : `${periodLabel}${requestedStart ? `: ${requestedStart} → ${endDate}` : ': all saved history'}. ` +
              (first && last
                ? `Available observations: ${first} → ${last}.`
                : 'No observations in this window.') +
              (limitedHistory
                ? ' Some saved runs do not cover the full period; run a longer backtest to extend history.'
                : '')}
      </p>
      {detailsQuery.error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>
            Could not load {periodLabel} history: {detailsQuery.error.message}
          </span>
          <Button
            variant="outline"
            disabled={detailsQuery.isFetching}
            onClick={() => {
              void detailsQuery.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Active strategies"
          value={strategiesQuery.data === undefined ? '—' : formatNumber(strategies.length, 0)}
          hint={
            runsQuery.data !== undefined
              ? `${String(runs.length)} runs · ${String(summary.runsLast30d)} in 30d`
              : runsUnavailable
                ? 'Run history unavailable'
                : 'Loading run history…'
          }
          isLoading={strategiesQuery.isPending}
          size="dense"
        />
        <StatTile
          label="Book Sharpe"
          value={!bookUnavailable && model.hasBook ? formatNumber(summary.sharpe) : '—'}
          tone={toneFromValue(summary.sharpe)}
          hint={`Equal-weight, ${periodLabel}`}
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label={`Alpha vs ${model.benchmark.title}`}
          value={
            !bookUnavailable && model.hasBook
              ? formatSigned(summary.alpha, (n) => formatPercent(n, 1))
              : '—'
          }
          tone={toneFromValue(summary.alpha)}
          hint={
            model.hasBook && !bookUnavailable
              ? `β ${formatNumber(summary.beta)} · annualised`
              : 'Annualised'
          }
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label="Book max drawdown"
          value={!bookUnavailable && model.hasBook ? formatPercent(summary.maxDrawdown, 1) : '—'}
          tone={summary.maxDrawdown < 0 ? 'loss' : 'neutral'}
          hint={
            model.hasBook && !bookUnavailable
              ? `vs ${formatPercent(summary.worstSingleDrawdown, 0)} worst single`
              : undefined
          }
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label="Avg pairwise ρ"
          value={
            !bookUnavailable && model.hasBook && model.lines.length > 1
              ? formatNumber(summary.averagePairwise)
              : '—'
          }
          hint="Lower is more diversified"
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label="Data through"
          value={bookUnavailable ? '—' : (last ?? '—')}
          hint={
            strategiesQuery.data !== undefined
              ? `Coverage ${String(summary.coverageTickers)} tickers`
              : 'Universe unavailable'
          }
          isLoading={loadingBook}
          size="dense"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ChartContainer
          title={`Strategies vs. ${model.benchmark.title} — rebased to 100`}
          height={300}
          isLoading={loadingBook}
        >
          {bookUnavailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Book history unavailable.
            </p>
          ) : (
            <ComparisonChart series={model.lines} benchmark={model.benchmark} />
          )}
        </ChartContainer>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Alpha table</CardTitle>
            <CardDescription>
              Against {model.benchmark.title}. Sparkline is rolling 63d Sharpe over the last year;
              the tick is zero.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Strategy alpha metrics">
              <thead className="tabular border-b text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                <tr className="[&>th]:px-2 [&>th]:pb-2 [&>th]:whitespace-nowrap [&>th:first-child]:pl-0 [&>th:last-child]:pr-0">
                  <th scope="col" className="text-left">
                    Strategy
                  </th>
                  <th scope="col" className="text-right normal-case">
                    α
                  </th>
                  <th scope="col" className="text-right normal-case">
                    β
                  </th>
                  <th scope="col" className="text-right">
                    Sharpe
                  </th>
                  <th scope="col" className="text-right">
                    Max DD
                  </th>
                  <th scope="col" className="text-left">
                    63d Sharpe
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row) => (
                  <tr
                    key={row.strategy.id}
                    className="border-b last:border-b-0 [&>td]:px-2 [&>td]:py-2 [&>td]:whitespace-nowrap [&>td:first-child]:pl-0 [&>td:last-child]:pr-0"
                  >
                    <td>
                      <div className="flex min-w-36 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ background: seriesColor(palette, row.strategy.colorIndex) }}
                          aria-hidden
                        />
                        <div className="max-w-64 whitespace-normal">
                          <p className="font-medium">{row.strategy.name}</p>
                          <p className="tabular text-[10px] text-muted-foreground">
                            {row.strategy.universe.join(' ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cn('tabular text-right', toneClass[toneFromValue(row.alpha)])}>
                      {formatSigned(row.alpha, (n) => formatPercent(n, 1))}
                    </td>
                    <td className="tabular text-right">{formatNumber(row.beta)}</td>
                    <td
                      className="tabular text-right"
                      title={Number.isFinite(row.sharpe) ? String(row.sharpe) : undefined}
                    >
                      {formatNumber(row.sharpe)}
                    </td>
                    <td className="tabular text-right text-[var(--loss)]">
                      {formatPercent(row.maxDrawdown, 1)}
                    </td>
                    <td>
                      <Sparkline
                        values={row.sparkline}
                        zeroTick={0}
                        stroke={seriesColor(palette, row.strategy.colorIndex)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loadingBook && model.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {bookUnavailable
                  ? 'Strategy metrics unavailable.'
                  : 'No completed-run observations in this window.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Universe</CardTitle>
            <CardDescription>
              Tickers by how many strategies trade them. Segments are the strategies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {model.universe.slice(0, 12).map((row) => (
              <div
                key={row.ticker}
                className="grid items-center gap-2 text-xs"
                style={{ gridTemplateColumns: '44px 1fr 16px 64px' }}
              >
                <span className="tabular font-medium">{row.ticker}</span>
                <div className="flex h-2.5 gap-px overflow-hidden rounded-sm">
                  {row.strategyIndexes.map((index) => (
                    <span
                      key={index}
                      className="h-full"
                      style={{
                        width: `${String(100 / widestUniverse)}%`,
                        background: seriesColor(palette, index),
                      }}
                    />
                  ))}
                </div>
                <span className="tabular text-right">{row.strategyIndexes.length}</span>
                <span className="tabular text-[10px] text-muted-foreground">
                  {row.coverageStart ?? '—'}
                </span>
              </div>
            ))}
            {!strategiesQuery.isPending && model.universe.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {strategiesUnavailable
                  ? 'Strategy universe unavailable.'
                  : 'No active strategy declares a universe.'}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <ChartContainer
          title="Return vs. drawdown — all runs"
          description="Up and left is better. Dot size is Sharpe; colour is the strategy. Each strategy's best run is labelled; hover for the rest."
          height={380}
          isLoading={runsQuery.isPending}
        >
          {runsUnavailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Run history unavailable.
            </p>
          ) : (
            <RiskReturnScatter
              backtests={runs}
              colorIndexFor={(run) => strategyIndex.get(run.strategyId)}
              legend={[
                ...new Map(
                  runs.flatMap((run) => {
                    const colorIndex = strategyIndex.get(run.strategyId);
                    return colorIndex === undefined
                      ? []
                      : [[run.strategyId, { label: run.strategyName, colorIndex }] as const];
                  }),
                ).values(),
              ]}
            />
          )}
        </ChartContainer>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                Indicators &amp; sentiment — universe <DemoBadge />
              </CardTitle>
              <CardDescription>
                Close of last session. RSI marks overbought/oversold; sentiment is the
                article-weighted score over 7 days, −1 to +1.
              </CardDescription>
            </div>
            {indicators.data?.length ? (
              <SentimentGauge label="Book sentiment" score={bookSentiment} />
            ) : null}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {strategiesUnavailable || indicators.error ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Universe indicators unavailable.
              </p>
            ) : (
              <IndicatorsTable
                rows={indicators.data ?? []}
                isLoading={strategiesQuery.isPending || indicators.isLoading}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                News — scored <DemoBadge />
              </CardTitle>
              <CardDescription>
                Only articles tagged to a ticker in the universe. The bar is the model’s sentiment
                for that article.
              </CardDescription>
            </div>
            <Segmented
              value={newsScope}
              options={NEWS_SCOPES}
              onChange={setNewsScope}
              ariaLabel="News scope"
            />
          </CardHeader>
          <CardContent>
            {(newsScope === 'universe' && strategiesUnavailable) || news.error ? (
              <p className="py-6 text-center text-sm text-muted-foreground">News unavailable.</p>
            ) : (
              <NewsList
                articles={news.data ?? []}
                isLoading={
                  (newsScope === 'universe' && strategiesQuery.isPending) || news.isLoading
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="text-[15px]">Recent runs</CardTitle>
          <Link
            to={paths.backtests}
            className="text-xs text-selected-foreground underline-offset-4 hover:underline"
          >
            View all backtests →
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {runsUnavailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Run history unavailable. Use Retry run history above to reload it.
            </p>
          ) : (
            <RecentRunsTable runs={runs.slice(0, 8)} isLoading={runsQuery.isPending} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
