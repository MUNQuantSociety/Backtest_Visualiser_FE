import { CandlestickChart } from 'lucide-react';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { CandleChart, type Candle } from '@/features/market';
import { formatPercent, formatSigned } from '@/utils/format';

import { periodChange, SCREENER_PERIODS, type ScreenerPeriod } from '../screener-model';

const PERIOD_OPTIONS = SCREENER_PERIODS.map((period) => ({ value: period, label: period }));

interface TrendChartProps {
  ticker: string | null;
  period: ScreenerPeriod;
  onPeriodChange: (period: ScreenerPeriod) => void;
  candles: Candle[] | undefined;
  isLoading: boolean;
  /** The failure's message, or null. */
  error: string | null;
}

/** The selected ticker's daily candles over 7D, 30D, 90D or 1Y. */
export function TrendChart({
  ticker,
  period,
  onPeriodChange,
  candles,
  isLoading,
  error,
}: TrendChartProps) {
  const change = candles ? periodChange(candles) : null;
  return (
    <ChartContainer
      title={ticker ? `${ticker} · ${period}` : 'Trend'}
      description={
        change === null
          ? 'Daily candles from FMP, with volume below.'
          : `${formatSigned(change, (value) => formatPercent(value))} over the period. Daily candles from FMP.`
      }
      height={380}
      actions={
        <Segmented
          value={period}
          options={PERIOD_OPTIONS}
          onChange={onPeriodChange}
          ariaLabel="Chart period"
        />
      }
    >
      <ChartBody ticker={ticker} candles={candles} isLoading={isLoading} error={error} />
    </ChartContainer>
  );
}

function ChartBody({
  ticker,
  candles,
  isLoading,
  error,
}: Pick<TrendChartProps, 'ticker' | 'candles' | 'isLoading' | 'error'>) {
  if (!ticker) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title="Select a ticker"
        description="Pick a row in the watchlist to chart it."
        className="h-full"
      />
    );
  }
  if (error) {
    return <EmptyState title="Chart could not be loaded" description={error} className="h-full" />;
  }
  if (isLoading || candles === undefined) {
    return <div className="size-full animate-pulse rounded-md bg-muted/40" />;
  }
  if (candles.length === 0) {
    return (
      <EmptyState
        title={`No sessions for ${ticker} in this period`}
        description="Try a longer period."
        className="h-full"
      />
    );
  }
  return <CandleChart candles={candles} />;
}
