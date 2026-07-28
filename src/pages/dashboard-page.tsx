import { PageHeader } from '@/components/common/page-header';
import { BacktestList } from '@/features/backtests';

/**
 * Pages are thin: they own layout and route params, and compose feature
 * components. Business logic and data fetching stay inside the features.
 * Default-exported so the router can lazy-load them.
 */
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Recent backtest runs and headline performance." />
      <BacktestList filters={{ pageSize: 6 }} />
    </>
  );
}
