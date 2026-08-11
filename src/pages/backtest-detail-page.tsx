import { FlaskConical } from 'lucide-react';
import { useParams } from 'react-router';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useBacktest } from '@/features/backtests';
import { EquityCurveChart, MetricsGrid, MetricsTable } from '@/features/performance';

export default function BacktestDetailPage() {
  const { backtestId } = useParams<{ backtestId: string }>();
  const { data, isPending, isError, error } = useBacktest(backtestId);

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance summary</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsTable detail={data} isLoading={isPending} />
        </CardContent>
      </Card>
    </>
  );
}
