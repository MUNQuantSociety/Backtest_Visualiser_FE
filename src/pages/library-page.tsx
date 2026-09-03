import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import {
  bestRunByStrategy,
  isPageSize,
  isRunSort,
  isStatusFilter,
  PAGE_SIZES,
  RUN_SORTS,
  RunBacktestDialog,
  RunsTable,
  useBacktest,
  useBacktests,
  useDeleteBacktest,
  viewRuns,
  type PageSize,
  type RunSort,
  type StatusFilter,
} from '@/features/backtests';
import {
  DailyPnlBars,
  EquityCurveChart,
  MetricsGrid,
  MonthlyReturnsHeatmap,
} from '@/features/performance';
import {
  isStrategyFilter,
  NewStrategyDialog,
  strategyColorIndex,
  StrategyPicker,
  useStrategies,
  type StrategyFilter,
} from '@/features/strategies';
import { seriesColor } from '@/lib/chart-theme';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

const VIEWS = [
  { value: 'best', label: 'Best run' },
  { value: 'latest', label: 'Latest' },
  { value: 'spec', label: 'Spec' },
] as const;
type View = (typeof VIEWS)[number]['value'];

const STATUS_OPTIONS = [
  { value: 'any', label: 'Status: any' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
] as const satisfies readonly { value: StatusFilter; label: string }[];

/** The last 90 sessions, which is what the daily P&L panel shows. */
const PNL_SESSIONS = 90;

/**
 * Strategies and their runs on one page, replacing the Strategies, Backtests
 * and Compare-picker pages. A strategy is the thing you test; a run is one
 * test of it, and the page is shaped that way: pick a strategy on the left,
 * its best run's tearsheet and every run it has ever had fill the right.
 *
 * Everything that changes what is shown lives in the URL — the strategy, the
 * view, the sort and filters — so a link to a strategy's runs sorted by Sharpe
 * is a link, matching how the compare and detail pages keep state. The
 * checkbox selection lives in the store instead, since it is per-session and
 * a URL full of run ids is not something anyone shares on purpose.
 */
export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const palette = useChartPalette();
  const searchRef = useRef<HTMLInputElement>(null);

  const strategiesQuery = useStrategies();
  const runsQuery = useBacktests();
  const strategies = strategiesQuery.data ?? [];
  const allRuns = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);

  const filterParam = searchParams.get('filter');
  const sortParam = searchParams.get('sort');
  const statusParam = searchParams.get('status');
  const filter: StrategyFilter = isStrategyFilter(filterParam) ? filterParam : 'all';
  const sort: RunSort = isRunSort(sortParam) ? sortParam : 'newest';
  const status: StatusFilter = isStatusFilter(statusParam) ? statusParam : 'any';
  const search = searchParams.get('q') ?? '';
  const pageSizeParam = Number(searchParams.get('show') ?? '25');
  const pageSize: PageSize = isPageSize(pageSizeParam) ? pageSizeParam : 25;
  const [view, setView] = useState<View>('best');

  // The selected strategy is the URL's, or the first that has a run.
  const requested = searchParams.get('strategy');
  const selectedId =
    requested && strategies.some((s) => s.id === requested)
      ? requested
      : ((strategies.find((s) => allRuns.some((run) => run.strategyId === s.id)) ?? strategies[0])
          ?.id ?? null);
  const strategy = strategies.find((s) => s.id === selectedId) ?? null;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  // `/` focuses search, as on the list and compare pages.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || target?.closest('input, textarea, [contenteditable]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Plain derivations, not useMemo: the compiler memoizes these itself, and a
  // manual memo it cannot prove safe (an array handed to another function)
  // makes it skip the whole component. Tens of runs; the work is trivial.
  const strategyRuns = allRuns.filter((run) => run.strategyId === selectedId);
  const bestRun = bestRunByStrategy(strategyRuns).get(selectedId ?? '');
  const latestRun = [...strategyRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const featured = view === 'latest' ? latestRun : bestRun;
  const detail = useBacktest(featured?.id);

  const runView = viewRuns(strategyRuns, { status, search, sort, pageSize });

  const selectedIds = useUiStore((state) => state.comparisonIds);
  const toggleComparison = useUiStore((state) => state.toggleComparison);
  const clearComparison = useUiStore((state) => state.clearComparison);
  const remove = useDeleteBacktest();
  const selectedRuns = selectedIds.flatMap((id) => {
    const run = allRuns.find((r) => r.id === id);
    return run ? [run] : [];
  });

  function deleteSelected() {
    const count = selectedRuns.length;
    if (count === 0) return;
    if (
      !window.confirm(
        `Delete ${String(count)} run${count === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return;
    }
    for (const run of selectedRuns) remove.mutate(run.id);
    clearComparison();
  }

  const running = (id: string) =>
    allRuns.filter(
      (run) => run.strategyId === id && (run.status === 'running' || run.status === 'queued'),
    ).length;

  const colorIndex = strategy ? strategyColorIndex(strategy, strategies) : null;
  const equityCurve = detail.data?.equityCurve ?? [];
  const loadingTearsheet = Boolean(featured) && detail.isPending;

  return (
    <>
      <PageHeader
        title="Library"
        description={`${String(strategies.length)} strategies · ${String(allRuns.length)} runs. A strategy is the thing you test; a run is one test of it.`}
        actions={
          <>
            <label className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => {
                  setParam('q', event.target.value);
                }}
                placeholder="Search strategies and runs"
                aria-label="Search strategies and runs"
                className="h-8 w-[220px] rounded-md border border-input bg-background pr-8 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <kbd className="tabular pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1 text-[10px] text-muted-foreground">
                /
              </kbd>
            </label>
            <NewStrategyDialog />
            <RunBacktestDialog initialStrategyKey={selectedId ?? undefined} />
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[272px_minmax(0,1fr)]">
        <StrategyPicker
          strategies={strategiesQuery.data}
          isLoading={strategiesQuery.isPending}
          filter={filter}
          onFilterChange={(next) => {
            setParam('filter', next === 'all' ? null : next);
          }}
          selectedId={selectedId}
          onSelect={(id) => {
            setParam('strategy', id);
          }}
          runningCount={running}
        />

        <div className="min-w-0 space-y-5">
          {strategy ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{
                        background:
                          colorIndex === null
                            ? 'var(--border-strong)'
                            : seriesColor(palette, colorIndex),
                      }}
                      aria-hidden
                    />
                    <span className="truncate">{strategy.name}</span>
                    {featured ? (
                      <span className="tabular truncate text-sm font-normal text-muted-foreground">
                        — {view === 'latest' ? 'latest run' : 'best run'}: {featured.symbol} ·{' '}
                        {featured.startDate} → {featured.endDate}
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
                    {strategy.description}
                  </p>
                </div>
                <Segmented
                  value={view}
                  options={VIEWS}
                  onChange={setView}
                  ariaLabel="Strategy view"
                />
              </div>

              {view === 'spec' ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px]">
                      <span className="tabular">{strategy.className}</span> — parameter spec
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* The catalogue carries the spec, not the source: the file
                        itself never leaves the engine. What can be shown is
                        what a run of it accepts. */}
                    {strategy.parameters.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tunable parameters.</p>
                    ) : (
                      <div className="tabular grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px] gap-2 text-xs">
                        <span className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Parameter
                        </span>
                        <span className="text-right text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Type
                        </span>
                        <span className="text-right text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Default
                        </span>
                        <span className="text-right text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Min
                        </span>
                        <span className="text-right text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                          Max
                        </span>
                        {strategy.parameters.map((spec) => (
                          <div key={spec.key} className="contents">
                            <span className="truncate border-t py-1.5 font-sans">{spec.label}</span>
                            <span className="border-t py-1.5 text-right text-muted-foreground">
                              {spec.type}
                            </span>
                            <span className="border-t py-1.5 text-right">
                              {String(spec.default)}
                            </span>
                            <span className="border-t py-1.5 text-right text-muted-foreground">
                              {spec.min ?? '—'}
                            </span>
                            <span className="border-t py-1.5 text-right text-muted-foreground">
                              {spec.max ?? '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {strategy.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {strategy.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : featured ? (
                <>
                  <MetricsGrid metrics={detail.data?.metrics} isLoading={loadingTearsheet} />
                  <ChartContainer
                    title="Performance vs. benchmark and drawdown"
                    description="Account value against buy-and-hold, with trade entries and distance below the running peak."
                    height={420}
                    isLoading={loadingTearsheet}
                  >
                    <EquityCurveChart
                      data={equityCurve}
                      trades={detail.data?.trades}
                      showDrawdownPane
                    />
                  </ChartContainer>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <ChartContainer
                      title="Monthly returns"
                      description="Shading scaled to the largest month in this grid. YTD is not shaded."
                      height={200}
                      isLoading={loadingTearsheet}
                    >
                      <MonthlyReturnsHeatmap data={equityCurve} />
                    </ChartContainer>
                    <ChartContainer
                      title="Daily profit &amp; loss"
                      description={`Last ${String(PNL_SESSIONS)} sessions. Bars are the day; the line is the run to date.`}
                      height={200}
                      isLoading={loadingTearsheet}
                    >
                      <DailyPnlBars data={equityCurve.slice(-PNL_SESSIONS)} />
                    </ChartContainer>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Never tested"
                  description={
                    strategy.status === 'active'
                      ? 'Run this strategy to see its tearsheet here.'
                      : 'Drafts and archived strategies have no runs to show.'
                  }
                  action={
                    strategy.status === 'active' ? (
                      <RunBacktestDialog initialStrategyKey={strategy.id} variant="outline" />
                    ) : undefined
                  }
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Runs</span>
                  <span className="tabular inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{
                        background:
                          colorIndex === null
                            ? 'var(--border-strong)'
                            : seriesColor(palette, colorIndex),
                      }}
                      aria-hidden
                    />
                    {strategy.className}
                    <span className="text-muted-foreground">
                      {String(strategyRuns.length)} runs
                    </span>
                  </span>
                  <Segmented
                    value={status}
                    options={STATUS_OPTIONS}
                    onChange={(next) => {
                      setParam('status', next === 'any' ? null : next);
                    }}
                    ariaLabel="Filter runs by status"
                  />
                </div>
                <Segmented
                  value={sort}
                  options={RUN_SORTS}
                  onChange={(next) => {
                    setParam('sort', next === 'newest' ? null : next);
                  }}
                  ariaLabel="Sort runs"
                />
              </div>

              <Card>
                <CardContent className="overflow-x-auto p-4">
                  <RunsTable
                    runs={runView.rows}
                    isLoading={runsQuery.isPending}
                    selectedIds={selectedIds}
                    onToggle={toggleComparison}
                  />
                  <div className="tabular mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatNumber(runView.rows.length, 0)} of {formatNumber(runView.total, 0)}{' '}
                      runs
                    </span>
                    <span className="flex items-center gap-1">
                      Show
                      {PAGE_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setParam('show', size === 25 ? null : String(size));
                          }}
                          className={cn(
                            'rounded px-1.5 py-0.5',
                            size === pageSize
                              ? 'bg-selected text-selected-foreground'
                              : 'hover:text-foreground',
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : strategiesQuery.isPending ? null : (
            <EmptyState title="No strategies yet" description="Add one with New strategy." />
          )}
        </div>
      </div>

      {selectedRuns.length > 0 ? (
        <div
          role="region"
          aria-label="Selected runs"
          className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-strong)] bg-card px-4 py-3 shadow-[0_12px_32px_rgb(0_0_0/0.35)]"
        >
          <span className="text-sm font-medium">
            {String(selectedRuns.length)} run{selectedRuns.length === 1 ? '' : 's'} selected
          </span>
          <span className="tabular min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {selectedRuns.map((run) => run.name).join(' · ')}
          </span>
          <Button variant="ghost" size="sm" onClick={clearComparison}>
            <X className="mr-1.5 size-3.5" aria-hidden />
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--loss)] hover:text-[var(--loss)]"
            onClick={deleteSelected}
            disabled={remove.isPending}
          >
            Delete
          </Button>
          <RunBacktestDialog
            initialStrategyKey={selectedRuns[0]?.strategyId}
            label="Re-run with new window"
            variant="outline"
          />
          <Button
            size="sm"
            disabled={selectedRuns.length < 2}
            onClick={() => {
              void navigate(`${paths.compare}?runs=${selectedRuns.map((run) => run.id).join(',')}`);
            }}
          >
            Compare {String(selectedRuns.length)} →
          </Button>
        </div>
      ) : null}
    </>
  );
}
