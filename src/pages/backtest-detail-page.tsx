import { FlaskConical } from 'lucide-react';
import { useParams } from 'react-router';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { useBacktest } from '@/features/backtests';

import { DrawdownChart } from '../features/performance/drawdown-chart';
import { EquityCurveChart } from '../features/performance/equity-curve-chart';
import { MetricsGrid } from '../features/performance/metrics-grid';

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

      <ChartContainer
        title="Equity curve"
        description="Account value over the backtest window, versus benchmark."
        height={380}
        isLoading={isPending}
      >
        <EquityCurveChart data={equityCurve} />
      </ChartContainer>

      <ChartContainer
        title="Drawdown"
        description="Distance below the running peak."
        height={220}
        isLoading={isPending}
      >
        <DrawdownChart data={equityCurve} />
      </ChartContainer>
    </>
  );
}
