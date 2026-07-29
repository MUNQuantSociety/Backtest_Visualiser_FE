import { useParams } from 'react-router';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DrawdownChart, EquityCurveChart } from '@/features/performance';
import {
  ConfigPanel,
  CorrelationMatrix,
  EngineStateBadge,
  ExecutionLogTable,
  PortfolioSummary,
  PortfolioSwitcher,
  PositionsTable,
  usePortfolio,
  usePortfolioEquity,
} from '@/features/portfolios';
import { formatNumber, formatPercent } from '@/utils/format';
import { maxDrawdown, sharpeRatio, toReturns } from '@/utils/metrics';

/**
 * The prototype's portfolio page — summary, historical graph, asset
 * correlations, trade log, asset breakdown, overall risk, drawdowns — with each
 * placeholder `<section>` replaced by the component that actually renders it.
 *
 * The charts are `EquityCurveChart` and `DrawdownChart` straight out of
 * `@/features/performance`, unchanged. That reuse is the entire argument for
 * porting this onto the React app instead of growing a second charting stack in
 * SvelteKit: theme-reactive palettes, canvas token resolution and the
 * lightweight-charts lifecycle were solved once.
 */
export default function PortfolioDetailPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const { data: portfolio, isPending, isError, error } = usePortfolio(portfolioId);
  const { data: equity, isPending: isEquityPending } = usePortfolioEquity(portfolioId);

  const points = equity?.points ?? [];
  const returns = toReturns(points.map((point) => point.equity));
  const hasSeries = points.length > 1;

  if (isError) {
    return (
      <>
        <PageHeader title="Portfolio" />
        <EmptyState title="Could not load this portfolio" description={error.message} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={portfolio?.name ?? 'Portfolio'}
        description={
          portfolio
            ? `${portfolio.strategyClass} · ${String(portfolio.tickers.length)} tickers · ${String(portfolio.config.INTERVAL)}m bars`
            : undefined
        }
        actions={portfolio ? <EngineStateBadge state={portfolio.state} /> : undefined}
      />

      <PortfolioSwitcher activeId={portfolioId} />

      <PortfolioSummary portfolio={portfolio} isLoading={isPending} />

      <ChartContainer
        title="Historical performance"
        description="Portfolio equity since the engine started."
        isLoading={isEquityPending}
        height={360}
      >
        {/* `EquitySamplePoint` is structurally `EquityPoint` minus the optional
            benchmark, so it satisfies the chart's contract without a cast. */}
        <EquityCurveChart data={points} showBenchmark={false} />
      </ChartContainer>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Drawdowns"
          description="Distance below the running peak."
          isLoading={isEquityPending}
        >
          <DrawdownChart data={points} />
        </ChartContainer>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overall risk</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {/* Computed client-side from the equity curve rather than fetched:
                these are cheap, and the engine's own risk numbers are scoped to
                the master portfolio, not a single sleeve. */}
            <StatTile
              label="Max drawdown"
              value={hasSeries ? formatPercent(maxDrawdown(points.map((p) => p.equity))) : '—'}
              tone="loss"
              isLoading={isEquityPending}
            />
            <StatTile
              label="Sharpe"
              value={hasSeries ? formatNumber(sharpeRatio(returns)) : '—'}
              hint="Annualised, client-side"
              isLoading={isEquityPending}
            />
            <StatTile
              label="Cash weight"
              value={portfolio ? formatPercent(portfolio.cash / portfolio.totalValue, 1) : '—'}
              hint="Risk-off trigger is 10%"
              isLoading={isPending}
            />
            <StatTile
              label="Consecutive failures"
              value={portfolio ? formatNumber(portfolio.consecutiveFailures, 0) : '—'}
              tone={portfolio && portfolio.consecutiveFailures > 0 ? 'loss' : 'neutral'}
              hint="Circuit breaker counter"
              isLoading={isPending}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Asset breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionsTable positions={portfolio?.positions} isLoading={isPending} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asset correlations</CardTitle>
          </CardHeader>
          <CardContent>
            <CorrelationMatrix portfolioId={portfolioId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigPanel config={portfolio?.config} isLoading={isPending} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trade log</CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutionLogTable portfolioId={portfolioId} />
        </CardContent>
      </Card>
    </>
  );
}
