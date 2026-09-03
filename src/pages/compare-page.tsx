import { Check, Link2, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  benchmarkCurve,
  chipParts,
  compareContext,
  compareMetricRows,
  deltaTone,
  describeComparison,
  parameterRows,
  RunPickerDialog,
  useBacktestDetails,
  winnerIndex,
  type BacktestDetail,
} from '@/features/backtests';
import {
  ComparisonChart,
  DrawdownOverlay,
  MonthlyDifferenceHeatmap,
  RollingSharpeOverlay,
} from '@/features/performance';
import { seriesColor } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';
import { formatRelativeDay } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

/** Beyond this the lines stop being distinguishable and the table stops fitting. */
const MAX_RUNS = 4;
const LETTERS = ['A', 'B', 'C', 'D'] as const;

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-muted-foreground',
} as const;

/**
 * What changed between runs, and what it bought.
 *
 * The runs come from `?runs=a,b`, so a comparison is a link: the Library's
 * selection bar pushes one, and "Copy link" hands it on. Opens empty with a
 * run picker when there is nothing in the URL.
 *
 * Two runs is the designed case — metrics get an A − B column coloured by
 * which side is better for that metric, and the monthly grid shows A minus
 * B. Three or four runs keep the side-by-side columns and the overlays; the
 * pairwise panels need a pair.
 */
export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const palette = useChartPalette();
  const [copied, setCopied] = useState(false);

  const ids = (searchParams.get('runs') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_RUNS);

  function setRuns(next: readonly string[]) {
    const params = new URLSearchParams(searchParams);
    if (next.length === 0) params.delete('runs');
    else params.set('runs', next.join(','));
    setSearchParams(params, { replace: true });
  }

  const { data: details, isPending } = useBacktestDetails(ids);
  // Selection order, not fetch order, so a run does not change letter when
  // another finishes loading.
  const ordered = ids.flatMap((id) => {
    const match = details.find((detail) => detail.id === id);
    return match ? [match] : [];
  });

  const picker = (
    <RunPickerDialog
      excludeIds={ids}
      disabled={ids.length >= MAX_RUNS}
      onPick={(id) => {
        setRuns([...ids, id]);
      }}
    />
  );

  if (ids.length === 0) {
    return (
      <>
        <PageHeader
          title="Compare"
          description="Pick two to four runs and every gap between them is explained below."
          actions={picker}
        />
        <EmptyState
          title="Nothing to compare yet"
          description="Add runs here, or tick them in the Library and press Compare."
          action={
            <Link
              to={paths.library}
              className="text-sm text-selected-foreground underline-offset-4 hover:underline"
            >
              Open the Library →
            </Link>
          }
        />
      </>
    );
  }

  const context = compareContext(ordered);
  const loading = isPending && ordered.length < ids.length;
  const strategyId = ordered[0]?.strategyId;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // Clipboard access can be refused; the URL bar still has the link.
    }
  }

  return (
    <>
      <div className="space-y-1">
        {context.sameStrategy && context.strategyName && strategyId ? (
          <nav aria-label="Breadcrumb" className="tabular text-xs text-muted-foreground">
            <Link to={paths.library} className="hover:text-foreground">
              Library
            </Link>
            <span className="mx-1.5">›</span>
            <Link to={paths.libraryStrategy(strategyId)} className="hover:text-foreground">
              {context.strategyName}
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-foreground">Compare</span>
          </nav>
        ) : null}
        <PageHeader
          title={`Compare ${String(ids.length)} run${ids.length === 1 ? '' : 's'}`}
          description={describeComparison(context, ordered.length)}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void copyLink();
                }}
              >
                {copied ? (
                  <Check className="mr-1.5 size-3.5" aria-hidden />
                ) : (
                  <Link2 className="mr-1.5 size-3.5" aria-hidden />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="mr-1.5 size-3.5" aria-hidden />
                Export PDF
              </Button>
              {picker}
            </>
          }
        />
      </div>

      {/* One chip per run: its letter is its colour everywhere below. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {ids.map((id, index) => {
          const run = ordered.find((detail) => detail.id === id);
          const colour = seriesColor(palette, index);
          return (
            <div
              key={id}
              className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
              style={{ boxShadow: `inset 3px 0 0 ${colour}` }}
            >
              <span
                className="tabular flex size-[22px] shrink-0 items-center justify-center rounded text-xs font-semibold"
                style={{ background: colour, color: 'var(--background)' }}
                aria-label={`Run ${LETTERS[index] ?? String(index + 1)}`}
              >
                {LETTERS[index] ?? String(index + 1)}
              </span>
              {run ? (
                <RunChip run={run} differingKeys={context.differingKeys} />
              ) : (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove run ${LETTERS[index] ?? String(index + 1)}`}
                onClick={() => {
                  setRuns(ids.filter((other) => other !== id));
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      {ids.length < 2 ? (
        <EmptyState
          title="One more to compare"
          description="A comparison needs at least two runs. Add another above."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-5">
            <MetricsCard runs={ordered} loading={loading} />
            <ParametersCard runs={ordered} loading={loading} />
          </div>

          <div className="space-y-5">
            <ChartContainer
              title="Equity — rebased to 100"
              description={`Vertical distance between ${LETTERS.slice(0, ordered.length).join(' and ')} is the difference in return. ${benchmarkCurve(ordered).title} dashed.`}
              height={300}
              isLoading={loading}
            >
              <ComparisonChart
                series={ordered.map((run, index) => ({
                  id: run.id,
                  title: LETTERS[index] ?? run.name,
                  points: run.equityCurve,
                  colorIndex: index,
                }))}
                benchmark={benchmarkCurve(ordered)}
              />
            </ChartContainer>

            <div className="grid gap-5 lg:grid-cols-2">
              <ChartContainer
                title="Drawdown"
                description="Overlaid, same axis. Where one hole is deeper, that run was slower to exit."
                height={160}
                isLoading={loading}
              >
                <DrawdownOverlay
                  series={ordered.map((run, index) => ({
                    id: run.id,
                    title: LETTERS[index] ?? run.name,
                    points: run.equityCurve,
                    colorIndex: index,
                  }))}
                />
              </ChartContainer>
              <ChartContainer
                title="Rolling Sharpe (63d)"
                description="Which run's edge is persistent, and which had three good months."
                height={160}
                isLoading={loading}
              >
                <RollingSharpeOverlay
                  series={ordered.map((run, index) => ({
                    id: run.id,
                    title: LETTERS[index] ?? run.name,
                    points: run.equityCurve,
                    colorIndex: index,
                  }))}
                />
              </ChartContainer>
            </div>

            {ordered.length === 2 && ordered[0] && ordered[1] ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-[15px]">
                    Monthly return difference — A minus B
                  </CardTitle>
                  <CardDescription>
                    Blue months A won, amber months B won. A run that wins on total return but loses
                    most months is winning on a few outliers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MonthlyDifferenceHeatmap a={ordered[0].equityCurve} b={ordered[1].equityCurve} />
                </CardContent>
              </Card>
            ) : ordered.length > 2 ? (
              <p className="text-xs text-muted-foreground">
                The month-by-month difference needs exactly two runs.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function RunChip({
  run,
  differingKeys,
}: {
  run: BacktestDetail;
  differingKeys: readonly string[];
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-medium">{run.name}</p>
        <span className="tabular shrink-0 text-[11px] text-muted-foreground">
          {formatRelativeDay(run.createdAt)}
        </span>
      </div>
      <p className="tabular mt-0.5 truncate text-[11px] text-muted-foreground">
        {chipParts(run, differingKeys).map((part, index) => (
          <span key={`${part.text}-${String(index)}`}>
            {index > 0 ? ' · ' : ''}
            <span className={cn(part.highlight && 'font-medium text-selected-foreground')}>
              {part.text}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

/** Header label for a run's column: its letter, plus the one parameter that differs. */
function columnLabel(run: BacktestDetail, index: number, differingKeys: readonly string[]): string {
  const letter = LETTERS[index] ?? String(index + 1);
  const key = differingKeys.length === 1 ? differingKeys[0] : undefined;
  if (!key) return letter;
  const value = run.parameters[key];
  return `${letter} · ${key} ${typeof value === 'number' || typeof value === 'string' ? String(value) : ''}`.trim();
}

function MetricsCard({ runs, loading }: { runs: readonly BacktestDetail[]; loading: boolean }) {
  const palette = useChartPalette();
  const context = compareContext(runs);
  const rows = compareMetricRows(runs);
  const pair = runs.length === 2;
  const columns = `minmax(0,1fr) repeat(${String(runs.length + (pair ? 1 : 0))}, 76px)`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px]">Metrics</CardTitle>
        <CardDescription>
          {pair
            ? 'Δ is A − B. Green when A is better, red when B is. Bold marks the winner.'
            : 'Bold marks the winner of each row.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading && runs.length === 0 ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="min-w-[360px]">
            <div
              className="tabular grid items-end gap-2 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
              style={{ gridTemplateColumns: columns }}
            >
              <span />
              {runs.map((run, index) => (
                <span
                  key={run.id}
                  className="truncate text-right normal-case"
                  style={{ color: seriesColor(palette, index) }}
                  title={run.name}
                >
                  {columnLabel(run, index, context.differingKeys)}
                </span>
              ))}
              {pair ? <span className="text-right normal-case">Δ A−B</span> : null}
            </div>
            {rows.map((row) => {
              const winner = winnerIndex(row);
              const delta = (row.values[0] ?? 0) - (row.values[1] ?? 0);
              return (
                <div
                  key={row.key}
                  className="grid items-center gap-2 border-b py-2 text-xs last:border-b-0"
                  style={{ gridTemplateColumns: columns }}
                >
                  <span className="truncate text-muted-foreground">{row.label}</span>
                  {row.values.map((value, index) => (
                    <span
                      key={`${row.key}-${String(index)}`}
                      className={cn('tabular text-right', winner === index && 'font-semibold')}
                    >
                      {row.format(value)}
                    </span>
                  ))}
                  {pair ? (
                    <span className={cn('tabular text-right', toneClass[deltaTone(row)])}>
                      {row.formatDelta(delta)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParametersCard({ runs, loading }: { runs: readonly BacktestDetail[]; loading: boolean }) {
  const rows = parameterRows(runs);
  const differing = rows.filter((row) => row.differs).length;
  const columns = `minmax(0,1fr) repeat(${String(runs.length)}, 76px)`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px]">Parameters</CardTitle>
        <CardDescription>
          {differing === 1
            ? 'Only the highlighted row differs.'
            : differing === 0
              ? 'Nothing differs.'
              : `${String(differing)} highlighted rows differ.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading && runs.length === 0 ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            These runs carry no parameters.
          </p>
        ) : (
          <div className="min-w-[300px]">
            {rows.map((row) => (
              <div
                key={row.key}
                className={cn(
                  'grid items-center gap-2 border-b px-1 py-1.5 text-xs last:border-b-0',
                  row.differs && 'rounded-sm bg-selected',
                )}
                style={{ gridTemplateColumns: columns }}
              >
                <span
                  className={cn(
                    'tabular truncate',
                    row.differs ? 'font-medium text-selected-foreground' : 'text-muted-foreground',
                  )}
                >
                  {row.key}
                </span>
                {row.values.map((value, index) => (
                  <span key={`${row.key}-${String(index)}`} className="tabular text-right">
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
