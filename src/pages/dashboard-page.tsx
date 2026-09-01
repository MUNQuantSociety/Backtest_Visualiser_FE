import { ChartContainer } from '@/components/charts/chart-container';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import {
  BacktestList,
  RunBacktestDialog,
  useBacktestDetails,
  useBacktests,
} from '@/features/backtests';
import { ComparisonChart, PnlHistogram, RiskReturnScatter } from '@/features/performance';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { mean } from '@/utils/metrics';
import { toneFromValue } from '@/utils/tone';

/** Curves get unreadable well before every run is on the chart. */
const OVERLAY_LIMIT = 4;

/**
 * The landing view: headline numbers, then the three questions worth asking
 * across a set of runs — how did they track, what did the return cost in
 * drawdown, and what does the trade distribution look like.
 *
 * Everything here is derived from the list payload plus a bounded number of
 * details, so the dashboard never fans out into one request per run.
 */
export default function DashboardPage() {
  const { data, isPending } = useBacktests();
  const runs = data?.items ?? [];

  // Only completed runs carry a full curve; a queued one would plot as a gap.
  const overlayIds = runs
    .filter((run) => run.status === 'completed')
    .slice(0, OVERLAY_LIMIT)
    .map((run) => run.id);

  const { data: details, isPending: isDetailPending } = useBacktestDetails(overlayIds);

  const sharpes = runs.map((run) => run.sharpe);
  const bestSharpe = sharpes.length > 0 ? Math.max(...sharpes) : 0;
  const averageReturn = mean(runs.map((run) => run.totalReturn));
  const totalTrades = details.reduce((sum, detail) => sum + detail.trades.length, 0);
  const allTrades = details.flatMap((detail) => detail.trades);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Recent backtest runs and headline performance."
        actions={<RunBacktestDialog />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Runs" value={formatNumber(runs.length, 0)} isLoading={isPending} />
        <StatTile
          label="Best Sharpe"
          value={runs.length > 0 ? formatNumber(bestSharpe) : '—'}
          tone={toneFromValue(bestSharpe)}
          hint="Across all runs"
          isLoading={isPending}
        />
        <StatTile
          label="Average return"
          value={runs.length > 0 ? formatSigned(averageReturn, (n) => formatPercent(n)) : '—'}
          tone={toneFromValue(averageReturn)}
          isLoading={isPending}
        />
        <StatTile
          label="Trades sampled"
          value={formatNumber(totalTrades, 0)}
          hint={`Across ${String(overlayIds.length)} completed runs`}
          isLoading={isDetailPending}
        />
      </div>

      <ChartContainer
        title="Recent runs, rebased to 100"
        description={`The ${String(overlayIds.length)} most recent completed runs on one axis.`}
        height={340}
        isLoading={isDetailPending && details.length === 0}
      >
        <ComparisonChart backtests={details} />
      </ChartContainer>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartContainer
          title="Return vs. drawdown"
          description="Up and to the left is better — return earned without a deep hole. Dot size is Sharpe."
          height={320}
          isLoading={isPending}
        >
          <RiskReturnScatter backtests={runs} />
        </ChartContainer>

        <ChartContainer
          title="Profit &amp; loss per trade"
          description="Every trade across the sampled runs, binned at zero."
          height={320}
          isLoading={isDetailPending && allTrades.length === 0}
        >
          <PnlHistogram trades={allTrades} />
        </ChartContainer>
      </div>

      <BacktestList filters={{ pageSize: 6 }} />
    </>
  );
}
