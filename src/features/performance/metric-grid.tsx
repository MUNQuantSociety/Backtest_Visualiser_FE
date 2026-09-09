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
  type MetricKey = Exclude<keyof PerformanceMetrics, 'unavailable'>;
  const display = (key: MetricKey, format: (value: number) => string) =>
    metrics && !metrics.unavailable?.[key] ? format(metrics[key]) : placeholder;
  const tone = (key: MetricKey) =>
    metrics && !metrics.unavailable?.[key] ? toneFromValue(metrics[key]) : 'neutral';

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Total return"
        value={display('totalReturn', (value) => formatSigned(value, (n) => formatPercent(n)))}
        tone={tone('totalReturn')}
        isLoading={isLoading}
      />
      <StatTile
        label="CAGR"
        value={display('cagr', (value) => formatSigned(value, (n) => formatPercent(n)))}
        tone={tone('cagr')}
        isLoading={isLoading}
      />
      <StatTile
        label="Sharpe"
        value={display('sharpe', formatNumber)}
        tone={tone('sharpe')}
        hint="Annualised, risk-adjusted"
        isLoading={isLoading}
      />
      <StatTile
        label="Max drawdown"
        value={display('maxDrawdown', formatPercent)}
        tone={metrics && metrics.maxDrawdown < 0 ? 'loss' : 'neutral'}
        isLoading={isLoading}
      />
      <StatTile
        label="Sortino"
        value={display('sortino', formatNumber)}
        hint="Downside deviation only"
        isLoading={isLoading}
      />
      <StatTile
        label="Volatility"
        value={display('volatility', formatPercent)}
        hint="Annualised"
        isLoading={isLoading}
      />
      <StatTile label="Win rate" value={display('winRate', formatPercent)} isLoading={isLoading} />
      <StatTile
        label="Profit factor"
        value={display('profitFactor', formatNumber)}
        hint={metrics ? `${String(metrics.totalTrades)} trades` : undefined}
        isLoading={isLoading}
      />
    </div>
  );
}
