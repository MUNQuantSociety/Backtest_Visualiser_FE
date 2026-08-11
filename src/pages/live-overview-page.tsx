import { Link } from 'react-router';

import { paths } from '../app/paths';
import { PageHeader } from '../components/common/page-header';
import { StatTile } from '../components/common/stat-tile';
import { buttonVariants } from '../components/ui/button';
import { PortfolioList } from '../features/portfolios/components/portfolio-list';
import { usePortfolioTotals } from '../features/portfolios/portfolios-api';
import { ServerStatusCard } from '../features/system/server-status-card';
import { formatCurrency, formatPercent, formatSigned } from '../utils/format';
import { toneFromValue } from '../utils/tone';


/**
 * The prototype's dashboard — "Latest Strategy Summary", balance, total P&L,
 * server status — rebuilt against real data.
 *
 * Pages stay thin: layout and route params only. The roll-up arithmetic lives
 * in the portfolios feature, not here.
 */
export default function LiveOverviewPage() {
  const { totals, isPending } = usePortfolioTotals();
  const placeholder = '—';

  return (
    <>
      <PageHeader
        title="MQS Live Trader"
        description="Live trading system. Every figure on this page is real money."
        // `buttonVariants` rather than <Button>: this navigates, so it must be
        // an anchor. Wrapping a <Link> in a <button> nests interactive elements
        // and breaks keyboard and screen-reader behaviour.
        actions={
          <Link
            to={paths.portfolios}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            All portfolios
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Balance"
          value={totals ? formatCurrency(totals.totalValue) : placeholder}
          hint={totals ? `${formatCurrency(totals.cash)} cash` : undefined}
          isLoading={isPending}
        />
        <StatTile
          label="Total P&L"
          value={totals ? formatSigned(totals.totalPnl, (n) => formatCurrency(n)) : placeholder}
          tone={totals ? toneFromValue(totals.totalPnl) : 'neutral'}
          hint={totals ? formatSigned(totals.totalReturn, (n) => formatPercent(n)) : undefined}
          isLoading={isPending}
        />
        <StatTile
          label="Today"
          value={totals ? formatSigned(totals.dayPnl, (n) => formatCurrency(n)) : placeholder}
          tone={totals ? toneFromValue(totals.dayPnl) : 'neutral'}
          isLoading={isPending}
        />
        <StatTile
          label="Active sleeves"
          value={
            totals
              ? `${String(totals.runningCount)} / ${String(totals.portfolioCount)}`
              : placeholder
          }
          hint="Portfolios with a live engine thread"
          isLoading={isPending}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Latest strategy summary</h2>
          <PortfolioList limit={4} />
        </section>

        <ServerStatusCard />
      </div>
    </>
  );
}
