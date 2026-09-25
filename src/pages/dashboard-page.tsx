import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { Sparkline } from '@/components/charts/sparkline';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import {
  alphaRows,
  bookCurve,
  buyHoldCurve,
  closesCurve,
  dashboardEndDate,
  dashboardNewsWindow,
  mergeRunRows,
  RecentRunsTable,
  returnCorrelation,
  RunBacktestDialog,
  RunPointerCard,
  summariseBook,
  topRunsByReturn,
  universeRows,
  useBacktestEquities,
  useBenchmarkCloses,
  useAllBacktests,
  usePendingRunRows,
  valuesAt,
  withBenchmarkCloses,
  type BookStrategy,
} from '@/features/backtests';
import {
  IndicatorsTable,
  NewsList,
  SentimentGauge,
  useIndicators,
  useRunNews,
} from '@/features/market';
import {
  ComparisonChart,
  RiskReturnScatter,
  type ChartPointer,
  type ComparisonSeries,
} from '@/features/performance';
import { useStrategies } from '@/features/strategies';
import { WatchlistCard } from '@/features/watchlist';
import { seriesColor } from '@/lib/chart-theme';
import {
  useDashboardBenchmark,
  useDashboardPeriod,
  useSetDashboardBenchmark,
  useSetDashboardPeriod,
  type DashboardBenchmark,
  type DashboardPeriod,
} from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';
import { useChartPalette } from '@/utils/use-chart-palette';

const DASHBOARD_NEWS_LIMIT = 8;
/** How many runs the comparison chart and alpha table show. */
const TOP_RUN_COUNT = 5;

const BENCHMARKS = [
  { value: 'spy', label: 'SPY' },
  { value: 'buyHold', label: 'Buy & hold' },
] as const satisfies readonly { value: DashboardBenchmark; label: string }[];

const BENCHMARK_TITLES: Record<DashboardBenchmark, string> = { spy: 'SPY', buyHold: 'Buy & hold' };

const BENCHMARK_DESCRIPTIONS: Record<DashboardBenchmark, string> = {
  spy: 'SPY’s daily closes over the same dates: did the run beat the market?',
  buyHold:
    'Each run’s own buy-and-hold of the tickers it traded; the chart line averages them. Did trading beat simply holding?',
};

/** Keeps the pointer card inside the chart: left of the pointer past the middle. */
const POINTER_CARD_WIDTH = 256;
const POINTER_CARD_GAP = 14;

const PERIODS = [
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
  { value: '5y', label: '5Y' },
  { value: 'max', label: 'Max' },
] as const satisfies readonly { value: DashboardPeriod; label: string }[];

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/**
 * Every saved run remains a separate comparison series, including reruns of
 * the same strategy and history whose strategy is no longer in the catalogue.
 * Curves share the selected calendar window; aggregate metrics use shared dates.
 */
export default function DashboardPage() {
  const period = useDashboardPeriod();
  const setPeriod = useSetDashboardPeriod();
  const palette = useChartPalette();

  const strategiesQuery = useStrategies();
  const runsQuery = useAllBacktests();
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);
  // Only the table shows runs still in flight; every figure on the book is
  // built from saved reports, and an unfinished run has none yet.
  const pendingRows = usePendingRunRows();
  const tableRuns = useMemo(() => mergeRunRows(runs, pendingRows), [runs, pendingRows]);

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

  const selectedRuns = useMemo(() => runs.filter((run) => run.status === 'completed'), [runs]);
  const runIds = selectedRuns.map((run) => run.id);
  const endDate = dashboardEndDate(selectedRuns) ?? '';
  const detailsQuery = useBacktestEquities(endDate ? runIds : [], { period, endDate });

  const runSeries = useMemo<BookStrategy[]>(
    () =>
      selectedRuns.map((run, index) => ({
        id: run.id,
        name: run.name,
        shortName: run.name,
        universe: run.symbol === 'MULTI' ? [] : [run.symbol],
        colorIndex: index,
      })),
    [selectedRuns],
  );
  const runIndex = new Map(runs.map((run) => [run.id, run]));

  const model = useMemo(() => {
    const byRun = new Map(
      detailsQuery.data
        .filter((detail) => detail.equityCurve.length > 0)
        .map((detail) => [detail.id, detail] as const),
    );
    const lines: ComparisonSeries[] = runSeries.flatMap((run) => {
      const detail = byRun.get(run.id);
      return detail
        ? [
            {
              id: run.id,
              title: run.name,
              points: detail.equityCurve,
              colorIndex: run.colorIndex,
            },
          ]
        : [];
    });
    const book = bookCurve(lines.map((line) => line.points));
    // The backend has already applied the shared calendar window.
    const rows = alphaRows(runSeries, byRun, 'max');
    const corr = returnCorrelation(runSeries, byRun, 'max');
    return {
      lines,
      book,
      rows,
      corr,
      hasBook: book.length > 2,
      universe: universeRows(strategies, runs),
    };
  }, [detailsQuery.data, strategies, runSeries, runs]);

  const [hiddenRunIds, setHiddenRunIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleRunSeries = (runId: string) => {
    setHiddenRunIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  // The comparison chart and alpha table: the top runs by total return over
  // the dashboard window, measured against the chosen benchmark.
  const benchmarkMode = useDashboardBenchmark();
  const setBenchmarkMode = useSetDashboardBenchmark();
  const topDetails = useMemo(
    () =>
      topRunsByReturn(
        detailsQuery.data.filter((detail) => detail.equityCurve.length > 1),
        TOP_RUN_COUNT,
      ),
    [detailsQuery.data],
  );
  const topStart = topDetails.map((detail) => detail.equityCurve[0]?.date ?? '').sort()[0] ?? '';
  const topEnd =
    topDetails
      .map((detail) => detail.equityCurve.at(-1)?.date ?? '')
      .sort()
      .at(-1) ?? '';
  // Every run's window, not only the top runs': the book's alpha uses it too.
  const withHistory = detailsQuery.data.filter((detail) => detail.equityCurve.length > 1);
  const allStart = withHistory.map((detail) => detail.equityCurve[0]?.date ?? '').sort()[0] ?? '';
  const allEnd =
    withHistory
      .map((detail) => detail.equityCurve.at(-1)?.date ?? '')
      .sort()
      .at(-1) ?? '';
  const spyCloses = useBenchmarkCloses(
    allStart,
    allEnd,
    benchmarkMode === 'spy' && withHistory.length > 0,
  );
  const comparison = useMemo(() => {
    const closes = spyCloses.data ?? [];
    const colorById = new Map(runSeries.map((run) => [run.id, run.colorIndex]));
    const measured = topDetails.map((detail) => ({
      ...detail,
      name: runIndex.get(detail.id)?.name ?? detail.id,
      equityCurve:
        benchmarkMode === 'spy'
          ? withBenchmarkCloses(detail.equityCurve, closes)
          : detail.equityCurve,
    }));
    const strategiesTop: BookStrategy[] = measured.map((detail) => ({
      id: detail.id,
      name: detail.name,
      shortName: detail.name,
      universe: detail.symbol === 'MULTI' ? [] : [detail.symbol],
      colorIndex: colorById.get(detail.id) ?? 0,
    }));
    const byRun = new Map(measured.map((detail) => [detail.id, detail] as const));
    const lines: ComparisonSeries[] = strategiesTop.map((strategy) => ({
      id: strategy.id,
      title: strategy.name,
      points: byRun.get(strategy.id)?.equityCurve ?? [],
      colorIndex: strategy.colorIndex,
    }));
    const benchmark = {
      title: BENCHMARK_TITLES[benchmarkMode],
      points:
        benchmarkMode === 'spy' ? closesCurve(closes, topStart, topEnd) : buyHoldCurve(topDetails),
    };
    return {
      measured,
      lines,
      benchmark,
      // The backend has already applied the shared calendar window.
      rows: alphaRows(strategiesTop, byRun, 'max'),
    };
    // runIndex is rebuilt each render from `runs`; its content follows `runs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topDetails, spyCloses.data, benchmarkMode, runSeries, runs, topStart, topEnd]);
  const visibleComparison = useMemo(
    () => comparison.lines.filter((line) => !hiddenRunIds.has(line.id)),
    [comparison.lines, hiddenRunIds],
  );

  // The pointer card: follows the crosshair, pins on click so its links work.
  const [pointer, setPointer] = useState<ChartPointer | null>(null);
  const [pinned, setPinned] = useState<ChartPointer | null>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const shownPointer = pinned ?? pointer;
  useEffect(() => {
    if (!pinned) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPinned(null);
    }
    function onPress(event: PointerEvent) {
      if (!chartAreaRef.current?.contains(event.target as Node)) setPinned(null);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPress);
    };
  }, [pinned]);
  const pointerRows = shownPointer
    ? valuesAt(
        shownPointer.date,
        comparison.measured.filter((detail) => !hiddenRunIds.has(detail.id)),
        benchmarkMode,
        spyCloses.data ?? [],
      )
    : [];
  const pointerCardLeft = shownPointer
    ? shownPointer.x > shownPointer.width / 2
      ? Math.max(0, shownPointer.x - POINTER_CARD_GAP - POINTER_CARD_WIDTH)
      : shownPointer.x + POINTER_CARD_GAP
    : 0;
  const colorByRun = new Map(comparison.lines.map((line) => [line.id, line.colorIndex ?? 0]));
  const spyUnavailable = benchmarkMode === 'spy' && spyCloses.isError;
  const shownCount = topDetails.length || TOP_RUN_COUNT;
  const topRunsLabel = `${String(shownCount)} ${shownCount === 1 ? 'run' : 'runs'}`;

  const universeTickers = useMemo(() => model.universe.map((row) => row.ticker), [model.universe]);
  const indicators = useIndicators(universeTickers);
  // News is historical, not a feed: it covers the same backtest window as the charts.
  const newsWindow = dashboardNewsWindow(selectedRuns, period);
  const news = useRunNews(
    { tickers: universeTickers, start: newsWindow?.start ?? '', end: newsWindow?.end ?? '' },
    DASHBOARD_NEWS_LIMIT,
  );

  const bookSentiment = useMemo(() => {
    const rows = indicators.data ?? [];
    if (rows.length === 0) return 0;
    return rows.reduce((sum, row) => sum + row.sentiment7d, 0) / rows.length;
  }, [indicators.data]);

  const strategiesUnavailable = strategiesQuery.isError && strategiesQuery.data === undefined;
  const runsUnavailable = runsQuery.isError && runsQuery.data === undefined;
  // A run whose history failed is dropped from the book and named below; the
  // book is only "unavailable" when nothing loaded at all.
  const bookUnavailable =
    runsUnavailable ||
    (!detailsQuery.isPending && detailsQuery.failed.length > 0 && detailsQuery.data.length === 0);
  const loadingBook =
    !bookUnavailable && (runsQuery.isPending || (runIds.length > 0 && detailsQuery.isPending));
  // The book (every run, equal weight) against the chosen benchmark.
  const summary = useMemo(() => {
    const benchmarkPoints =
      benchmarkMode === 'spy'
        ? closesCurve(spyCloses.data ?? [], allStart, allEnd)
        : buyHoldCurve(detailsQuery.data);
    return summariseBook(
      model.book,
      benchmarkPoints,
      model.rows,
      model.corr.averagePairwise,
      strategies,
      runs,
    );
  }, [model, benchmarkMode, spyCloses.data, allStart, allEnd, detailsQuery.data, strategies, runs]);
  const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? '';
  const last = model.lines
    .flatMap((line) => line.points.at(-1)?.date ?? [])
    .sort()
    .at(-1);
  const strategyIndex = new Map(strategies.map((strategy) => [strategy.id, strategy.colorIndex]));

  return (
    <>
      <PageHeader
        title="Dashboard"
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

      {detailsQuery.error && !detailsQuery.isPending ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>
            {bookUnavailable
              ? `Could not load ${periodLabel} history: ${detailsQuery.error.message}`
              : `${String(detailsQuery.failed.length)} of ${String(runIds.length)} runs ${
                  detailsQuery.failed.length === 1 ? 'is' : 'are'
                } missing from the book: ${
                  detailsQuery.failed.length === 1 ? 'its' : 'their'
                } ${periodLabel} history could not be loaded (${detailsQuery.error.message}).`}
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
          hint={`Equal-weight runs, ${periodLabel}`}
          isLoading={loadingBook}
          size="dense"
        />
        <StatTile
          label={`Alpha vs ${BENCHMARK_TITLES[benchmarkMode]}`}
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

      <Card aria-label="Benchmark">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-[15px]">Benchmark</CardTitle>
            <CardDescription>{BENCHMARK_DESCRIPTIONS[benchmarkMode]}</CardDescription>
          </div>
          <Segmented
            value={benchmarkMode}
            options={BENCHMARKS}
            onChange={setBenchmarkMode}
            ariaLabel="Benchmark"
          />
        </CardHeader>
        {spyUnavailable ? (
          <CardContent>
            <p role="status" className="text-xs text-[var(--loss)]">
              SPY prices are unavailable right now; its line and the α and β against it are missing.
            </p>
          </CardContent>
        ) : null}
      </Card>

      {/* Side by side only from 1400px: narrower, the alpha table squeezes its
          run names and scrolls; stacked, each half gets the full width. */}
      <div className="grid gap-5 min-[1400px]:grid-cols-2">
        <ChartContainer
          title={`Top ${topRunsLabel} vs. ${comparison.benchmark.title} — rebased to 100`}
          height={300}
          isLoading={loadingBook}
        >
          {bookUnavailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Book history unavailable.
            </p>
          ) : (
            <div
              ref={chartAreaRef}
              className="relative size-full"
              onPointerLeave={() => {
                setPointer(null);
              }}
            >
              <ComparisonChart
                series={visibleComparison}
                benchmark={comparison.benchmark}
                showSeriesLabels={false}
                onPointerMove={setPointer}
                onPointerClick={setPinned}
              />
              {shownPointer && pointerRows.length > 0 ? (
                <RunPointerCard
                  date={shownPointer.date}
                  rows={pointerRows}
                  benchmarkTitle={comparison.benchmark.title}
                  colorFor={(runId) => seriesColor(palette, colorByRun.get(runId) ?? 0)}
                  pinned={pinned !== null}
                  onClose={() => {
                    setPinned(null);
                  }}
                  className="absolute top-2 z-20"
                  style={{ left: pointerCardLeft }}
                />
              ) : null}
            </div>
          )}
        </ChartContainer>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Run alpha table</CardTitle>
            <CardDescription>
              The top {topRunsLabel} by total return over the period, against{' '}
              {comparison.benchmark.title}. α is annualised. Runs that never traded are left out.
            </CardDescription>
          </CardHeader>
          <CardContent
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Scrollable run alpha table"
          >
            <table
              className="w-full min-w-[500px] table-fixed text-xs"
              aria-label="Run alpha metrics"
            >
              {/* Number columns sized to their widest value; the run name
                  takes what is left and wraps rather than truncating. */}
              <colgroup>
                <col />
                <col className="w-[68px]" />
                <col className="w-[64px]" />
                <col className="w-[52px]" />
                <col className="w-[60px]" />
                <col className="w-[64px]" />
                <col className="w-[84px]" />
              </colgroup>
              <thead className="tabular border-b text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                <tr className="[&>th]:px-2 [&>th]:pb-2 [&>th]:font-medium [&>th]:whitespace-nowrap [&>th:first-child]:pl-0 [&>th:last-child]:pr-0">
                  <th scope="col" className="text-left">
                    Run
                  </th>
                  <th scope="col" className="text-right">
                    Return
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
                  <th scope="col" className="text-right">
                    63d Sharpe
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row, rank) => {
                  const isVisible = !hiddenRunIds.has(row.run.id);
                  const color = seriesColor(palette, row.strategy.colorIndex);
                  const curve = row.run.equityCurve;
                  const first = curve[0]?.equity;
                  const lastEquity = curve.at(-1)?.equity;
                  const totalReturn =
                    first && lastEquity !== undefined ? lastEquity / first - 1 : null;
                  return (
                    <tr
                      key={row.strategy.id}
                      className="border-b align-middle last:border-b-0 [&>td]:px-2 [&>td]:py-2.5 [&>td:first-child]:pl-0 [&>td:last-child]:pr-0 [&>td:not(:first-child)]:whitespace-nowrap"
                    >
                      <td>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="tabular w-3 shrink-0 text-[10px] text-muted-foreground">
                            {rank + 1}
                          </span>
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleRunSeries(row.run.id)}
                            aria-label={`Show ${row.strategy.name} on comparison chart`}
                            title={`${isVisible ? 'Hide' : 'Show'} ${row.strategy.name} on chart`}
                            className="size-3.5 shrink-0 cursor-pointer rounded-[3px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none"
                            style={{ accentColor: color }}
                          />
                          <div className="min-w-0">
                            <Link
                              to={paths.backtestDetail(row.run.id)}
                              className="line-clamp-2 font-medium [overflow-wrap:anywhere] hover:underline"
                              title={row.strategy.name}
                            >
                              {row.strategy.name}
                            </Link>
                            <p className="tabular truncate text-[10px] text-muted-foreground">
                              {runIndex.get(row.run.id)?.strategyName} · {row.run.symbol}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td
                        className={cn(
                          'tabular text-right',
                          totalReturn === null ? '' : toneClass[toneFromValue(totalReturn)],
                        )}
                      >
                        {totalReturn === null
                          ? '—'
                          : formatSigned(totalReturn, (n) => formatPercent(n, 1))}
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
                        <div className="flex justify-end">
                          <Sparkline
                            values={row.sparkline}
                            zeroTick={0}
                            stroke={color}
                            width={64}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loadingBook && comparison.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {bookUnavailable
                  ? 'Run metrics unavailable.'
                  : 'No run traded in this window; runs whose value never moved are left out.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <WatchlistCard
          // Side by side, the chart card sets the row's height and the
          // watchlist fills it, scrolling its rows; stacked, it keeps its own.
          className="xl:h-0 xl:min-h-full"
          universe={model.universe}
          palette={palette}
          isLoading={strategiesQuery.isPending}
          isUnavailable={strategiesUnavailable}
        />

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

      {/* Same breakpoint: the indicators table needs ~610px beside the news. */}
      <div className="grid gap-5 min-[1400px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                Indicators &amp; sentiment — universe
              </CardTitle>
              <CardDescription>
                Close of last session. RSI marks overbought/oversold; sentiment is the mean article
                score over 7 days, −1 to +1.
              </CardDescription>
            </div>
            {indicators.data?.length ? (
              <SentimentGauge label="Book sentiment" score={bookSentiment} />
            ) : null}
          </CardHeader>
          <CardContent>
            {strategiesUnavailable || indicators.error ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Universe indicators unavailable.
              </p>
            ) : (
              <div
                className="report-table-scroll"
                role="region"
                aria-label="Universe indicator rows"
                tabIndex={0}
              >
                <IndicatorsTable
                  rows={indicators.data ?? []}
                  isLoading={strategiesQuery.isPending || indicators.isLoading}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-[15px]">News — scored</CardTitle>
            <CardDescription>
              {newsWindow
                ? `Universe articles from the backtest window, ${newsWindow.start} to ${newsWindow.end}, newest first. The bar is the model’s sentiment for each.`
                : 'Articles appear for the window of your completed backtests.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {strategiesUnavailable || news.error ? (
              <p className="py-6 text-center text-sm text-muted-foreground">News unavailable.</p>
            ) : newsWindow ? (
              <NewsList
                articles={news.data ?? []}
                isLoading={strategiesQuery.isPending || news.isLoading}
              />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No completed backtests yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="text-[15px]">All saved runs</CardTitle>
          <Link
            to={paths.backtests}
            className="text-xs text-selected-foreground underline-offset-4 hover:underline"
          >
            View all backtests →
          </Link>
        </CardHeader>
        <CardContent>
          {runsUnavailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Run history unavailable. Use Retry run history above to reload it.
            </p>
          ) : (
            <div
              className="report-table-scroll"
              role="region"
              aria-label="Saved runs rows"
              tabIndex={0}
            >
              <RecentRunsTable runs={tableRuns} isLoading={runsQuery.isPending} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
