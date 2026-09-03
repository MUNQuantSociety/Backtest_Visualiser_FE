import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { EquityPoint } from '@/features/backtests';
import { formatCompact, formatCurrency } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

interface DailyPnlBarsProps {
  data: readonly EquityPoint[];
}

/**
 * Daily P&L as bars around zero, with cumulative P&L as a line on a second
 * scale — the bar-and-line pair a trading desk keeps on screen.
 *
 * Two y-scales on one frame is normally a mistake, and it is justified here by
 * exactly one thing: the bars answer "how was today" and the line answers "how
 * is the month", and a trader asks both in the same glance. The cumulative axis
 * is on the right in the line's own colour, so which number belongs to which
 * scale is never ambiguous.
 */
export function DailyPnlBars({ data }: DailyPnlBarsProps) {
  const palette = useChartPalette();

  const rows = useMemo(() => {
    let cumulative = 0;
    const out: { date: string; change: number; cumulative: number }[] = [];
    for (let i = 1; i < data.length; i += 1) {
      const previous = data[i - 1];
      const current = data[i];
      if (!previous || !current) continue;
      const change = current.equity - previous.equity;
      cumulative += change;
      out.push({ date: current.date, change, cumulative });
    }
    return out;
  }, [data]);

  if (rows.length < 2) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Not enough history for a daily breakdown.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          minTickGap={48}
        />
        <YAxis
          yAxisId="daily"
          tickFormatter={(value: number) => formatCompact(value)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={52}
        />
        {/* Right axis in the line's colour — the pairing must not be ambiguous. */}
        <YAxis
          yAxisId="cumulative"
          orientation="right"
          tickFormatter={(value: number) => formatCompact(value)}
          tick={{ fill: palette.series[0], fontSize: 11 }}
          stroke={palette.grid}
          width={56}
        />
        <Tooltip
          cursor={{ fill: palette.grid, opacity: 0.25 }}
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0), 'USD', { maximumFractionDigits: 0 }),
            String(name),
          ]}
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
        <ReferenceLine yAxisId="daily" y={0} stroke={palette.mutedText} />
        <Bar yAxisId="daily" name="Day" dataKey="change" isAnimationActive={false}>
          {rows.map((row) => (
            <Cell key={row.date} fill={row.change >= 0 ? palette.profit : palette.loss} />
          ))}
        </Bar>
        <Line
          yAxisId="cumulative"
          name="Cumulative (right axis)"
          type="monotone"
          dataKey="cumulative"
          stroke={palette.series[0]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
