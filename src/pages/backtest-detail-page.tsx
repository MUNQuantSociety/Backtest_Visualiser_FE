import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useBacktest } from '@/features/backtests';
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

  if (isError) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="Could not load this backtest"
        description={error.message}
      />
    );
  }

  const equityCurve = data?.equityCurve ?? [];
  const trades = data?.trades ?? [];

  return (
    <>
      <PageHeader
        title={data?.name ?? 'Backtest'}
        description={
          data
            ? `${data.strategyName} · ${data.symbol} · ${data.startDate} → ${data.endDate}`
            : undefined
        }
      />

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
                ? 'bg-accent font-medium text-accent-foreground'
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
            title="Performance vs. benchmark and drawdown"
            description="Account value against buy-and-hold, with trade entries and distance below the running peak."
            height={520}
            isLoading={isPending}
          >
            <EquityCurveChart data={equityCurve} trades={data?.trades} showDrawdownPane />
          </ChartContainer>

          <ChartContainer
            title="Monthly returns"
            description="Compounded return per calendar month, with the year to date on the right. Shading is scaled to the largest month in this grid."
            height={200}
            isLoading={isPending}
          >
            <MonthlyReturnsHeatmap data={equityCurve} />
          </ChartContainer>

          <ChartContainer
            title="Daily profit &amp; loss"
            description="Bars are the day; the line is the run to date on the right axis."
            height={280}
            isLoading={isPending}
          >
            <DailyPnlBars data={equityCurve} />
          </ChartContainer>
        </>
      ) : null}

      {active === 'risk' ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Rolling Sharpe (63d)"
              description="Below zero the quarter underperformed cash — a stronger statement than “did badly”."
              height={280}
              isLoading={isPending}
            >
              <RollingSharpeChart data={equityCurve} />
            </ChartContainer>
            <ChartContainer
              title="Rolling volatility (63d)"
              description="A vol-targeted strategy should be a flat line here. This is the test it passes or fails."
              height={280}
              isLoading={isPending}
            >
              <RollingVolatilityChart data={equityCurve} />
            </ChartContainer>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Daily return distribution"
              description="Sharpe, volatility and VaR all assume this shape is roughly normal. The overlay is where you check."
              height={300}
              isLoading={isPending}
            >
              <ReturnsDistribution data={equityCurve} />
            </ChartContainer>
            <ChartContainer
              title="Strategy vs. benchmark"
              description="β near 1 with a high R² is the market wearing a different name, however good the Sharpe looks."
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
                  Two runs with the same −18% can be a three-week dip and a nine-month grind. Only
                  the duration tells you which.
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
