import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { EquityPoint } from '@/features/backtests';
import { formatNumber } from '@/utils/format';
import { rollingSharpe, sharpeRatio, toReturns } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface RollingSharpeChartProps {
  data: readonly EquityPoint[];
  /** Trailing window in bars. 63 ≈ one quarter of trading days. */
  window?: number;
}

/**
 * Sharpe over a trailing window, against the full-period Sharpe as a reference.
 *
 * The tearsheet's Sharpe is one number for the whole run and cannot distinguish
 * a steadily good strategy from one that earned everything in a single quarter.
 * This is the chart that tells them apart, so it belongs *next to* the scalar,
 * never instead of it.
 *
 * Zero is a hard reference line, not a gridline: below it the window
 * underperformed cash, which is a stronger and more specific statement than
 * "did badly".
 */
export function RollingSharpeChart({ data, window = 63 }: RollingSharpeChartProps) {
  const palette = useChartPalette();

  const { rows, fullPeriod } = useMemo(() => {
    const returns = toReturns(data.map((point) => point.equity));
    const series = rollingSharpe(returns, window);
    return {
      rows: series.map((value, index) => ({
        date: data[index + 1]?.date ?? '',
        sharpe: value,
      })),
      fullPeriod: sharpeRatio(returns),
    };
  }, [data, window]);

  if (rows.filter((row) => row.sharpe !== null).length < 2) {
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
          tickFormatter={(value: number) => formatNumber(value, 1)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={44}
        />
        <Tooltip
          formatter={(value) => [formatNumber(Number(value ?? 0)), `${String(window)}-bar Sharpe`]}
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
        {/* Below zero the window underperformed cash. */}
        <ReferenceLine y={0} stroke={palette.mutedText} strokeOpacity={0.7} />
        <ReferenceLine
          y={fullPeriod}
          stroke={palette.mutedText}
          strokeDasharray="4 3"
          label={{
            value: `Full period ${formatNumber(fullPeriod)}`,
            position: 'insideTopRight',
            fill: palette.mutedText,
            fontSize: 11,
          }}
        />
        <Line
          type="monotone"
          dataKey="sharpe"
          stroke={palette.series[0]}
          strokeWidth={1.75}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
