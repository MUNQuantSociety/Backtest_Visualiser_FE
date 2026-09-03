import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCompact, formatCurrency, formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

import type { PortfolioSummary } from '../types';

interface SleevePnlChartProps {
  portfolios: readonly PortfolioSummary[];
}

/**
 * Total P&L by sleeve.
 *
 * The overview's stat tiles give one aggregate number, which hides whether it
 * came from every sleeve pulling together or one winner carrying four losers.
 * A signed bar per sleeve answers that at a glance, and the zero line is drawn
 * explicitly so "below water" is unmistakable rather than inferred from tick
 * labels.
 */
export function SleevePnlChart({ portfolios }: SleevePnlChartProps) {
  const palette = useChartPalette();

  if (portfolios.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No sleeves configured.
      </p>
    );
  }

  const data = portfolios.map((portfolio) => ({
    name: portfolio.name,
    pnl: portfolio.totalPnl,
    totalReturn: portfolio.totalReturn,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          interval={0}
          // Sleeve names are long; truncating beats overlapping or rotating.
          tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompact(value)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={56}
        />
        <ReferenceLine y={0} stroke={palette.mutedText} strokeWidth={1} />
        <Tooltip
          cursor={{ fill: palette.grid, opacity: 0.25 }}
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
          formatter={(value, _name, item) => {
            const row = item.payload as { totalReturn: number } | undefined;
            const suffix = row ? ` (${formatPercent(row.totalReturn, 1)})` : '';
            return [`${formatCurrency(Number(value ?? 0))}${suffix}`, 'Total P&L'];
          }}
        />
        <Bar dataKey="pnl" isAnimationActive={false} radius={[3, 3, 0, 0]}>
          {data.map((row) => (
            <Cell key={row.name} fill={row.pnl >= 0 ? palette.profit : palette.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
