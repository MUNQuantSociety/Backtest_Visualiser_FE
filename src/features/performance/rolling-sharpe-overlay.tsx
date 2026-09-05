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

import { alignByDate } from '@/features/backtests';
import { seriesColor } from '@/lib/chart-theme';
import { formatNumber } from '@/utils/format';
import { rollingSharpe, toReturns } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

import type { OverlaySeries } from './drawdown-overlay';

interface RollingSharpeOverlayProps {
  series: readonly OverlaySeries[];
  /** Trailing window in bars. 63 ≈ one quarter. */
  window?: number | undefined;
}

/**
 * Trailing Sharpe for several runs on one axis.
 *
 * Which run's edge is persistent, and which had three good months: the
 * full-period Sharpe in the metrics card cannot tell those apart, and this is
 * the chart that does. Zero is a hard reference line, not a gridline — below
 * it the window underperformed cash.
 */
export function RollingSharpeOverlay({ series, window = 63 }: RollingSharpeOverlayProps) {
  const palette = useChartPalette();

  const rows = useMemo(() => {
    const { dates, columns } = alignByDate(series.map((s) => s.points));
    const rolling = columns.map((column) => rollingSharpe(toReturns(column), window));
    // Returns start one bar in, so row i of the rolling series is date i + 1.
    return dates.slice(1).map((date, i) => {
      const row: Record<string, number | string | null> = { date };
      series.forEach((s, index) => {
        row[s.id] = rolling[index]?.[i] ?? null;
      });
      return row;
    });
  }, [series, window]);

  const usable = rows.filter((row) => series.some((s) => row[s.id] !== null)).length;
  if (usable < 2) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Not enough shared history for a {String(window)}-bar rolling window.
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
          width={40}
        />
        <Tooltip
          formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name)]}
          contentStyle={{
            background: palette.background,
            border: `1px solid ${palette.grid}`,
            borderRadius: 6,
            color: palette.text,
            fontSize: 12,
          }}
          itemStyle={{ color: palette.text }}
        />
        <ReferenceLine y={0} stroke={palette.gridStrong} />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.title}
            stroke={seriesColor(palette, s.colorIndex)}
            strokeWidth={1.25}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
