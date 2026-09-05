import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Trade } from '@/features/backtests';
import { formatCompact, formatCurrency, formatNumber } from '@/utils/format';
import { histogram } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface PnlHistogramProps {
  trades: readonly Trade[];
  /** Bins on each side of zero. */
  binsPerSide?: number;
}

/**
 * Distribution of realised P&L per trade.
 *
 * Recharts rather than lightweight-charts: this is a categorical chart with a
 * custom tooltip and per-bar colour, not a time series, and building it on a
 * canvas price-chart library would be a fight for no gain.
 *
 * Colour carries the sign, which only works because `histogram()` forces a bin
 * edge at exactly zero — otherwise the central bar would mix winners and losers
 * and its colour would mean nothing.
 */
export function PnlHistogram({ trades, binsPerSide = 12 }: PnlHistogramProps) {
  const palette = useChartPalette();

  const bins = useMemo(
    () =>
      histogram(
        trades.map((trade) => trade.pnl),
        binsPerSide,
      ).map((bin) => ({ ...bin, midpoint: (bin.from + bin.to) / 2 })),
    [trades, binsPerSide],
  );

  if (bins.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No closed trades to plot.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="midpoint"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(value: number) => formatCompact(value)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          minTickGap={28}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={40}
        />
        <Tooltip
          cursor={{ fill: palette.grid, opacity: 0.25 }}
          formatter={(value) => [formatNumber(Number(value ?? 0), 0), 'Trades']}
          labelFormatter={(_label, payload) => {
            const bin = payload?.[0]?.payload as { from: number; to: number } | undefined;
            if (!bin) return '';
            return `${formatCurrency(bin.from, 'USD', { maximumFractionDigits: 0 })} to ${formatCurrency(bin.to, 'USD', { maximumFractionDigits: 0 })}`;
          }}
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
        <Bar dataKey="count" isAnimationActive={false}>
          {bins.map((bin) => (
            <Cell
              key={`${String(bin.from)}-${String(bin.to)}`}
              fill={bin.from >= 0 ? palette.profit : palette.loss}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
