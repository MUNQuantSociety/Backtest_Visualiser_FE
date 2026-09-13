import { ArrowLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  NoTradesExplanation,
  RunBacktestDialog,
  RunStatusBanner,
  TradesTable,
  useBacktest,
} from '@/features/backtests';
import {
  BetaScatter,
  DailyPnlBars,
  DrawdownChart,
  DrawdownTable,
  EquityCurveChart,
  MetricsGrid,
  MetricsTable,
  MonthlyReturnsHeatmap,
  PnlHistogram,
  ReturnsDistribution,
  RollingSharpeChart,
  RollingVolatilityChart,
  TradeDurationScatter,
} from '@/features/performance';
import { cn } from '@/lib/utils';

/**
 * Grouped into tabs rather than one long scroll.
 *
 * The page went from four panels to fourteen. Stacked, a reader loses the thread
 * well before the bottom, and the grouping is not arbitrary — it is the order the
 * questions get asked: did it make money, what did that cost, how did it trade,
 * and what are the exact numbers. That is how a tearsheet is read anyway.
 *
 * The active tab lives in the URL so a link to a run's risk panels is shareable,
 * matching how the list and compare pages already keep their state.
 */
const TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'risk', label: 'Risk' },
  { id: 'trades', label: 'Trades' },
  { id: 'tearsheet', label: 'Tearsheet' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export default function BacktestDetailPage() {
  const { backtestId } = useParams<{ backtestId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, isError, error } = useBacktest(backtestId);

  const fromUrl = searchParams.get('tab');
  const [fallback, setFallback] = useState<TabId>('performance');
  const active: TabId = isTabId(fromUrl) ? fromUrl : fallback;

  const selectTab = (id: TabId) => {
    setFallback(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const breadcrumbs = (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link to={paths.dashboard} className="hover:text-foreground hover:underline">
            Dashboard
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5" />
        </li>
        <li>
          <Link to={paths.backtests} className="hover:text-foreground hover:underline">
            Backtests
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5" />
        </li>
        <li className="min-w-0 break-words text-foreground" aria-current="page">
          {data?.name ?? 'Results'}
        </li>
      </ol>
    </nav>
  );
  const backLink = (
    <Link to={paths.backtests} className={buttonVariants({ variant: 'outline' })}>
      <ArrowLeft aria-hidden />
      Back to backtests
    </Link>
  );

  if (isError) {
    return (
      <>
        {breadcrumbs}
        <PageHeader title="Backtest results" actions={backLink} />
        <EmptyState
          icon={FlaskConical}
          title="Could not load this backtest"
          description={error.message}
        />
      </>
    );
  }

  const equityCurve = data?.equityCurve ?? [];
  const trades = data?.trades ?? [];

  return (
    <>
      {breadcrumbs}
      <PageHeader
        title="Backtest results"
        description={
          data
            ? `${data.name} · ${data.strategyName} · ${data.symbol} · ${data.startDate} → ${data.endDate}`
            : 'Loading run details…'
        }
        actions={
          <>
            {backLink}
            <RunBacktestDialog initialStrategyKey={data?.strategyId} />
          </>
        }
      />

      {/* Keep execution context visible alongside progress and failure reasons,
          before readers interpret empty panels or unavailable metrics. */}
      {data ? <RunStatusBanner run={data} /> : null}
      {data ? <NoTradesExplanation run={data} /> : null}
      {data?.status === 'completed' && data.reportMetadata?.execution?.fillCount === 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          Explore another strategy or run a different date window.
          <Link
            to={paths.backtests}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Choose a strategy →
          </Link>
        </p>
      ) : null}

      <MetricsGrid metrics={data?.metrics} isLoading={isPending} />

      <div
        role="tablist"
        aria-label="Backtest analysis"
        className="flex self-start rounded-md border border-border p-0.5"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => {
              selectTab(tab.id);
            }}
            className={cn(
              'cursor-pointer rounded-sm px-3.5 py-1.5 text-sm transition-colors',
              active === tab.id
                ? 'bg-selected font-medium text-selected-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'performance' ? (
        <>
          {/* One figure, two panes. The drawdown shares the equity curve's time
              axis so a dip and the hole it dug line up vertically — reading them
              off two separately-scaled charts meant re-anchoring on the dates. */}
          <ChartContainer
            title={`Performance vs. benchmark and drawdown${data ? ` — ${data.name}` : ''}`}
            height={600}
            isLoading={isPending}
          >
            <EquityCurveChart data={equityCurve} trades={data?.trades} showDrawdownPane />
          </ChartContainer>

          <ChartContainer
            title="Monthly returns"
            description="Compounded returns from this run’s equity. The Year column includes only the dates covered by the run."
            height={200}
            isLoading={isPending}
          >
            <MonthlyReturnsHeatmap data={equityCurve} initialCapital={data?.initialCapital} />
          </ChartContainer>

          <ChartContainer
            title="Daily profit &amp; loss"
            description="Bars show daily account-value changes ($); the line shows total P&L since the run started ($, right axis)."
            height={280}
            isLoading={isPending}
          >
            <DailyPnlBars data={equityCurve} initialCapital={data?.initialCapital} />
          </ChartContainer>
        </>
      ) : null}

      {active === 'risk' ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Rolling Sharpe (63d)"
              description="Trailing 63 daily returns, annualised with 252 trading days and a 2% annual risk-free rate."
              height={280}
              isLoading={isPending}
            >
              <RollingSharpeChart data={equityCurve} />
            </ChartContainer>
            <ChartContainer
              title="Rolling volatility (63d)"
              description="Sample standard deviation of 63 daily returns, annualised with 252 trading days."
              height={280}
              isLoading={isPending}
            >
              <RollingVolatilityChart data={equityCurve} />
            </ChartContainer>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Daily return distribution"
              description="Observed daily returns. The dashed threshold is the empirical 5th percentile; the normal curve is a visual comparison."
              height={300}
              isLoading={isPending}
            >
              <ReturnsDistribution data={equityCurve} />
            </ChartContainer>
            <ChartContainer
              title="Strategy vs. benchmark"
              description="Paired daily returns and their linear fit. α is the raw-return intercept × 252; β is the slope; R² measures the fit."
              height={300}
              isLoading={isPending}
            >
              <BetaScatter data={equityCurve} />
            </ChartContainer>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Drawdowns"
              description="Distance below the running peak."
              height={260}
              isLoading={isPending}
            >
              <DrawdownChart data={equityCurve} />
            </ChartContainer>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Worst drawdowns</CardTitle>
                <CardDescription>
                  Peak-to-trough declines in this run’s equity. Durations count trading
                  observations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DrawdownTable data={equityCurve} isLoading={isPending} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {active === 'trades' ? (
        <>
          <TradesTable detail={data} isLoading={isPending} />
          <ChartContainer
            title="Distribution of profit &amp; loss per trade"
            description="Realised P&amp;L per closed trade. Bins split at zero, so colour always matches sign."
            height={300}
            isLoading={isPending}
          >
            <PnlHistogram trades={trades} />
          </ChartContainer>

          <ChartContainer
            title="Holding period vs. profit &amp; loss"
            description="Red far to the right is a strategy that cuts winners early and lets losers run. The dashed line is the median hold."
            height={320}
            isLoading={isPending}
          >
            <TradeDurationScatter trades={trades} />
          </ChartContainer>
        </>
      ) : null}

      {active === 'tearsheet' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Performance summary</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsTable detail={data} isLoading={isPending} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
