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
import { rollingVolatility } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

import { datedReturns } from './chart-data';

interface RollingVolatilityChartProps {
  data: readonly EquityPoint[];
  window?: number;
  benchmarkLabel?: string;
}

/** Sample volatility of observed daily returns over complete trailing windows. */
export function RollingVolatilityChart({
  data,
  window = 63,
  benchmarkLabel = 'Buy & hold',
}: RollingVolatilityChartProps) {
  const palette = useChartPalette();

  const { rows, hasBenchmark } = useMemo(() => {
    const dated = datedReturns(data);
    const strategy = rollingVolatility(
      dated.map((point) => point.strategy),
      window,
    );
    const benchmark = rollingVolatility(
      dated.map((point) => point.benchmark),
      window,
    );
    return {
      hasBenchmark: benchmark.some((value) => value !== null),
      rows: strategy.map((value, index) => ({
        date: dated[index]?.date ?? '',
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
          interval="preserveStartEnd"
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
            borderRadius: 6,
            color: palette.text,
            fontSize: 12,
          }}
          // Recharts colours each tooltip row from the series colour and
          // falls back to `#000` when there is none to take. A bar coloured
          // by a `<Cell>` has none, so those rows rendered pure black on the
          // dark tooltip. `itemStyle` is spread after that fallback, so it wins.
          itemStyle={{ color: palette.text }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: palette.mutedText }} />
        <Line
          type="linear"
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
            type="linear"
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
