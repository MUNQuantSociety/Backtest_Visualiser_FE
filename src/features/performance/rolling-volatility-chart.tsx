import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { EquityPoint } from '@/features/backtests';
import { formatPercent } from '@/utils/format';
import { rollingVolatility, toReturns } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface RollingVolatilityChartProps {
  data: readonly EquityPoint[];
  window?: number;
  benchmarkLabel?: string;
}

/**
 * Annualised rolling volatility, strategy against benchmark.
 *
 * The tearsheet's volatility is an average over the whole run and says nothing
 * about whether the risk was taken evenly. This shows regime: a strategy whose
 * vol triples in a selloff is sized wrong, and a vol-targeted strategy should be
 * a flat line here — the test it either passes or fails.
 *
 * Plotted against the benchmark's own rolling vol, because "volatile" only means
 * something relative to what the market was doing at the time.
 */
export function RollingVolatilityChart({
  data,
  window = 63,
  benchmarkLabel = 'Buy & hold',
}: RollingVolatilityChartProps) {
  const palette = useChartPalette();

  const { rows, hasBenchmark } = useMemo(() => {
    const benchmarkPresent = data.some(
      (point) => point.benchmark !== null && point.benchmark !== undefined,
    );
    const strategy = rollingVolatility(toReturns(data.map((point) => point.equity)), window);
    const benchmark = benchmarkPresent
      ? rollingVolatility(toReturns(data.map((point) => point.benchmark ?? point.equity)), window)
      : [];
    return {
      hasBenchmark: benchmarkPresent,
      rows: strategy.map((value, index) => ({
        date: data[index + 1]?.date ?? '',
        strategy: value,
        benchmark: benchmark[index] ?? null,
      })),
    };
  }, [data, window]);

  if (rows.filter((row) => row.strategy !== null).length < 2) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Not enough history for a {String(window)}-bar rolling window.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(value: number) => formatPercent(value, 0)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={52}
        />
        <Tooltip
          formatter={(value, name) => [formatPercent(Number(value ?? 0), 1), String(name)]}
          contentStyle={{
            background: palette.background,
            border: `1px solid ${palette.grid}`,
            borderRadius: 8,
            color: palette.text,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: palette.mutedText }} />
        <Line
          type="monotone"
          name={`Strategy (${String(window)}d)`}
          dataKey="strategy"
          stroke={palette.series[0]}
          strokeWidth={1.75}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {hasBenchmark ? (
          <Line
            type="monotone"
            name={benchmarkLabel}
            dataKey="benchmark"
            stroke={palette.series[2]}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
