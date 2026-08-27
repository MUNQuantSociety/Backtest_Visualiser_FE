import { StatTile } from '@/components/common/stat-tile';
import type { PerformanceMetrics } from '@/features/backtests';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

interface MetricsGridProps {
    metrics: PerformanceMetrics | undefined;
    isLoading?: boolean;
}

export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
    const placeholder = '—';

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
                label="Total return"
                value={
                    metrics
                        ? formatSigned(metrics.totalReturn, (n) => formatPercent(n))
                        : placeholder
                }
                tone={metrics ? toneFromValue(metrics.totalReturn) : 'neutral'}
                isLoading={isLoading}
            />
            <StatTile
                label="CAGR"
                value={metrics ? formatSigned(metrics.cagr, (n) => formatPercent(n)) : placeholder}
                tone={metrics ? toneFromValue(metrics.cagr) : 'neutral'}
                isLoading={isLoading}
            />
            <StatTile
                label="Sharpe"
                value={metrics ? formatNumber(metrics.sharpe) : placeholder}
                tone={metrics ? toneFromValue(metrics.sharpe) : 'neutral'}
                hint="Annualised, risk-adjusted"
                isLoading={isLoading}
            />
            <StatTile
                label="Max drawdown"
                value={metrics ? formatPercent(metrics.maxDrawdown) : placeholder}
                tone={metrics && metrics.maxDrawdown < 0 ? 'loss' : 'neutral'}
                isLoading={isLoading}
            />
            <StatTile
                label="Sortino"
                value={metrics ? formatNumber(metrics.sortino) : placeholder}
                hint="Downside deviation only"
                isLoading={isLoading}
            />
            <StatTile
                label="Volatility"
                value={metrics ? formatPercent(metrics.volatility) : placeholder}
                hint="Annualised"
                isLoading={isLoading}
            />
            <StatTile
                label="Win rate"
                value={metrics ? formatPercent(metrics.winRate) : placeholder}
                isLoading={isLoading}
            />
            <StatTile
                label="Profit factor"
                value={metrics ? formatNumber(metrics.profitFactor) : placeholder}
                hint={metrics ? `${String(metrics.totalTrades)} trades` : undefined}
                isLoading={isLoading}
            />
        </div>
    );
}
