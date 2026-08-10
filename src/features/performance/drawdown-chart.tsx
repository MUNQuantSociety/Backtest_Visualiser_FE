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

import type { EquityPoint } from '@/features/backtests';
import { formatPercent } from '@/utils/format';
import { drawdownSeries } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface DrawdownChartProps {
  data: readonly EquityPoint[];
}

interface DrawdownDatum {
  date: string;
  drawdown: number;
}

/**
 * Underwater plot: how far below the running peak the strategy sat at each
 * point. Recharts is a better fit than lightweight-charts here — this is a
 * derived statistical view, not a price series needing a synced time axis.
 */
export function DrawdownChart({ data }: DrawdownChartProps) {
  const palette = useChartPalette();

  const points = useMemo<DrawdownDatum[]>(() => {
    const drawdowns = drawdownSeries(data.map((point) => point.equity));
    return drawdowns.map((point) => ({
      date: data[point.index]?.date ?? '',
      drawdown: point.drawdown,
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="drawdown-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.loss} stopOpacity={0.05} />
            <stop offset="100%" stopColor={palette.loss} stopOpacity={0.4} />
          </linearGradient>
        </defs>

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
          width={56}
        />
        <Tooltip
          formatter={(value) => [formatPercent(Number(value ?? 0)), 'Drawdown']}
          contentStyle={{
            background: palette.background,
            border: `1px solid ${palette.grid}`,
            borderRadius: 8,
            color: palette.text,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke={palette.loss}
          strokeWidth={1.5}
          fill="url(#drawdown-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
