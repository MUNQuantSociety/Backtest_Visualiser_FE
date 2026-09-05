import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { CorrelationGrid } from '@/components/charts/correlation-grid';
import { Sparkline } from '@/components/charts/sparkline';
import { DemoBadge } from '@/components/common/demo-badge';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import {
  alphaRows,
  benchmarkCurve,
  bestRunByStrategy,
  bookCurve,
  RecentRunsTable,
  returnCorrelation,
  RunBacktestDialog,
  sliceToPeriod,
  summariseBook,
  universeRows,
  useBacktestDetails,
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

const ALPHA_COLUMNS = 'minmax(0,1fr) 54px 36px 44px 54px 84px';

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
 * Every number is derived on the client from the list payload plus one detail
 * per active strategy, so the page never fans out into a request per run. The
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
  const bestIds = useMemo(
    () => strategies.flatMap((strategy) => bestRuns.get(strategy.id)?.id ?? []),
    [strategies, bestRuns],
  );
  const detailsQuery = useBacktestDetails(bestIds);

  const model = useMemo(() => {
    const byStrategy = new Map(
      detailsQuery.data.map((detail) => [detail.strategyId, detail] as const),
    );
    const lines: ComparisonSeries[] = strategies.flatMap((strategy) => {
      const detail = byStrategy.get(strategy.id);
      return detail
        ? [
            {
              id: strategy.id,
              title: strategy.shortName,
              points: sliceToPeriod(detail.equityCurve, period),
              colorIndex: strategy.colorIndex,
            },
          ]
        : [];
    });
    const windows = detailsQuery.data.map((detail) => ({
      ...detail,
      equityCurve: [...sliceToPeriod(detail.equityCurve, period)],
    }));
    const book = bookCurve(lines.map((line) => line.points));
    const benchmark = benchmarkCurve(windows);
    const rows = alphaRows(strategies, byStrategy, period);
    const corr = returnCorrelation(strategies, byStrategy, period);
    const summary = summariseBook(
      book,
      benchmark.points,
      rows,
      corr.averagePairwise,
      strategies,
      runs,
    );
    return { lines, benchmark, rows, corr, summary, universe: universeRows(strategies, runs) };
  }, [detailsQuery.data, strategies, period, runs]);

  const universeTickers = useMemo(() => model.universe.map((row) => row.ticker), [model.universe]);
  const indicators = useIndicators(universeTickers);
  const [newsScope, setNewsScope] = useState<NewsScope>('universe');
  const news = useNews(universeTickers, newsScope);

  const bookSentiment = useMemo(() => {
    const rows = indicators.data ?? [];
    if (rows.length === 0) return 0;
    return rows.reduce((sum, row) => sum + row.sentiment7d, 0) / rows.length;
  }, [indicators.data]);

  const loading = strategiesQuery.isPending || runsQuery.isPending;
  const loadingBook = loading || (bestIds.length > 0 && detailsQuery.isPending);
  const { summary } = model;
  const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? '';
  const first = model.lines[0]?.points[0]?.date;
  const last = model.lines[0]?.points.at(-1)?.date;
  const strategyIndex = new Map(strategies.map((strategy) => [strategy.id, strategy.colorIndex]));
  const widestUniverse = model.universe[0]?.strategyIndexes.length ?? 1;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          strategies.length > 0 && first && last
            ? `${String(strategies.length)} active strategies as an equal-weight book, against ${model.benchmark.title} buy & hold. ${first} → ${last}.`
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Active strategies"
          value={formatNumber(strategies.length, 0)}
          hint={`${String(runs.length)} runs · ${String(summary.runsLast30d)} in 30d`}
          isLoading={loading}
          size="dense"
        />
        <StatTile
          label="Book Sharpe"
          value={formatNumber(summary.sharpe)}
          tone={toneFromValue(summary.sharpe)}
          hint={`Equal-weight, ${periodLabel}`}
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label={`Alpha vs ${model.benchmark.title}`}
          value={formatSigned(summary.alpha, (n) => formatPercent(n, 1))}
          tone={toneFromValue(summary.alpha)}
          hint={`β ${formatNumber(summary.beta)} · annualised`}
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label="Book max drawdown"
          value={formatPercent(summary.maxDrawdown, 1)}
          tone={summary.maxDrawdown < 0 ? 'loss' : 'neutral'}
          hint={`vs ${formatPercent(summary.worstSingleDrawdown, 0)} worst single`}
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label="Avg pairwise ρ"
          value={formatNumber(summary.averagePairwise)}
          hint="Lower is more diversified"
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label="Data through"
          value={summary.dataThrough ?? '—'}
          hint={`Coverage ${String(summary.coverageTickers)} tickers`}
          isLoading={loading}
          size="dense"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[680px_minmax(0,1fr)]">
        <ChartContainer
          title={`Strategies vs. ${model.benchmark.title} — rebased to 100`}
          description="Best runs per strategy. Vertical distance is the difference in return; the dashed line is what doing nothing earned."
          height={300}
          isLoading={loadingBook}
        >
          <ComparisonChart series={model.lines} benchmark={model.benchmark} />
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
            <div
              className="tabular grid gap-2 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
              style={{ gridTemplateColumns: ALPHA_COLUMNS }}
            >
              <span>Strategy</span>
              {/* `normal-case`: the header is uppercase, and uppercasing α and
                  β turns them into Α and Β, which read as Latin A and B. */}
              <span className="text-right normal-case">α</span>
              <span className="text-right normal-case">β</span>
              <span className="text-right">Sharpe</span>
              <span className="text-right">Max DD</span>
              <span>63d Sharpe</span>
            </div>
            {model.rows.map((row) => (
              <div
                key={row.strategy.id}
                className="grid items-center gap-2 border-b py-2 text-xs last:border-b-0"
                style={{ gridTemplateColumns: ALPHA_COLUMNS }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ background: seriesColor(palette, row.strategy.colorIndex) }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.strategy.name}</p>
                    <p className="tabular truncate text-[10px] text-muted-foreground">
                      {row.strategy.universe.join(' ')}
                    </p>
                  </div>
                </div>
                <span className={cn('tabular text-right', toneClass[toneFromValue(row.alpha)])}>
                  {formatSigned(row.alpha, (n) => formatPercent(n, 1))}
                </span>
                <span className="tabular text-right">{formatNumber(row.beta)}</span>
                <span className="tabular text-right">{formatNumber(row.sharpe)}</span>
                <span className="tabular text-right text-[var(--loss)]">
                  {formatPercent(row.maxDrawdown, 1)}
                </span>
                <Sparkline
                  values={row.sparkline}
                  zeroTick={0}
                  stroke={seriesColor(palette, row.strategy.colorIndex)}
                />
              </div>
            ))}
            {!loadingBook && model.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No completed runs for an active strategy yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Return correlation</CardTitle>
            <CardDescription>
              Daily returns, {periodLabel}. Blue is positive, red negative. Two strategies above 0.6
              are one bet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CorrelationGrid labels={model.corr.labels} matrix={model.corr.matrix} />
          </CardContent>
        </Card>

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
            {!loading && model.universe.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active strategy declares a universe.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <ChartContainer
          title="Return vs. drawdown — all runs"
          description="Up and left is better. Dot size is Sharpe; colour is the strategy."
          height={260}
          isLoading={loading}
        >
          <RiskReturnScatter
            backtests={runs}
            colorIndexFor={(run) => strategyIndex.get(run.strategyId)}
          />
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
            <SentimentGauge label="Book sentiment" score={bookSentiment} />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <IndicatorsTable rows={indicators.data ?? []} isLoading={indicators.isPending} />
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
            <NewsList articles={news.data ?? []} isLoading={news.isPending} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="text-[15px]">Recent runs</CardTitle>
          <Link
            to={paths.library}
            className="text-xs text-selected-foreground underline-offset-4 hover:underline"
          >
            All {String(runs.length)} in Library →
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <RecentRunsTable runs={runs.slice(0, 8)} isLoading={runsQuery.isPending} />
        </CardContent>
      </Card>
    </>
  );
}
