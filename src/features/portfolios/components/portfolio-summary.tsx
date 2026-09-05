import { StatTile } from '@/components/common/stat-tile';
import { formatCurrency, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { PortfolioDetail } from '../types';

interface PortfolioSummaryProps {
  portfolio: PortfolioDetail | undefined;
  isLoading?: boolean | undefined;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

/**
 * The prototype's "Summary" block. Its Start Date / End Date pair does not
 * survive the port: a live portfolio has no end date, it is still running. The
 * honest equivalent is when it started and when it last ticked — the second of
 * which is the number that tells you whether the thing is actually alive.
 */
export function PortfolioSummary({ portfolio, isLoading = false }: PortfolioSummaryProps) {
  const placeholder = '—';

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Total value"
        value={portfolio ? formatCurrency(portfolio.totalValue) : placeholder}
        hint={portfolio ? `${formatCurrency(portfolio.cash)} cash` : undefined}
        isLoading={isLoading}
      />
      <StatTile
        label="Total P&L"
        value={
          portfolio
            ? formatSigned(portfolio.totalPnl, (value) => formatCurrency(value))
            : placeholder
        }
        tone={portfolio ? toneFromValue(portfolio.totalPnl) : 'neutral'}
        hint={
          portfolio
            ? formatSigned(portfolio.totalReturn, (value) => formatPercent(value))
            : undefined
        }
        isLoading={isLoading}
      />
      <StatTile
        label="Starting capital"
        value={portfolio ? formatCurrency(portfolio.startingCapital) : placeholder}
        hint={portfolio ? `Since ${dateFormat.format(new Date(portfolio.startedAt))}` : undefined}
        isLoading={isLoading}
      />
      <StatTile
        label="Capital allocation"
        value={portfolio ? formatPercent(portfolio.allocationWeight, 0) : placeholder}
        hint="Share of the master portfolio"
        isLoading={isLoading}
      />
    </div>
  );
}
