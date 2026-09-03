import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { alignByDate, type EquityPoint } from '@/features/backtests';
import { seriesColor } from '@/lib/chart-theme';
import { formatPercent } from '@/utils/format';
import { drawdownSeries } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

export interface OverlaySeries {
  id: string;
  title: string;
  points: readonly EquityPoint[];
  colorIndex: number;
}

interface DrawdownOverlayProps {
  series: readonly OverlaySeries[];
}

/**
 * Several runs' drawdowns on one axis, as translucent filled areas.
 *
 * Overlaid rather than stacked or side by side: the question is which run's
 * hole was deeper on the same dates, and only a shared axis answers it. The
 * runs are first restricted to the dates they all have, so a run over a
 * longer window cannot shift another's along the axis.
 */
export function DrawdownOverlay({ series }: DrawdownOverlayProps) {
  const palette = useChartPalette();

  const rows = useMemo(() => {
    const { dates, columns } = alignByDate(series.map((s) => s.points));
    const drawdowns = columns.map((column) => drawdownSeries(column));
    return dates.map((date, i) => {
      const row: Record<string, number | string> = { date };
      series.forEach((s, index) => {
        row[s.id] = drawdowns[index]?.[i]?.drawdown ?? 0;
      });
      return row;
    });
  }, [series]);

  if (rows.length < 2) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        The runs share too few dates to overlay.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(value: number) => formatPercent(value, 0)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={48}
        />
        <Tooltip
          formatter={(value, name) => [formatPercent(Number(value ?? 0)), String(name)]}
          contentStyle={{
            background: palette.background,
            border: `1px solid ${palette.grid}`,
            borderRadius: 6,
            color: palette.text,
            fontSize: 12,
          }}
          itemStyle={{ color: palette.text }}
        />
        {series.map((s) => (
          <Area
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.title}
            stroke={seriesColor(palette, s.colorIndex)}
            strokeWidth={1}
            fill={seriesColor(palette, s.colorIndex)}
            fillOpacity={0.28}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
