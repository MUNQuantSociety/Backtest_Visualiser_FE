import { useMemo } from 'react';
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import type { Trade } from '@/features/backtests';
import { formatCompact, formatCurrency, formatNumber } from '@/utils/format';
import { holdingBars } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface TradeDurationScatterProps {
  trades: readonly Trade[];
}

/**
 * Holding period against realised P&L, one dot per closed trade.
 *
 * The diagnostic a P&L histogram cannot give: whether the losers are the trades
 * held too long. A cloud of red far to the right is a strategy with no exit
 * discipline — it cuts winners early and lets losers run, which is the classic
 * failure mode and is invisible in every scalar on the tearsheet.
 *
 * The median holding period is drawn as a reference so "too long" is measured
 * against the strategy's own behaviour rather than a hunch.
 */
export function TradeDurationScatter({ trades }: TradeDurationScatterProps) {
  const palette = useChartPalette();

  const model = useMemo(() => {
    const points = trades.flatMap((trade) => {
      const days = holdingBars(trade.entryDate, trade.exitDate);
      // Open positions have no realised P&L to plot against.
      if (days === null) return [];
      return [{ id: trade.id, days, pnl: trade.pnl, symbol: trade.symbol }];
    });

    if (points.length === 0) return null;

    const sorted = [...points].map((point) => point.days).sort((a, b) => a - b);
    return { points, median: sorted[Math.floor(sorted.length / 2)] ?? 0 };
  }, [trades]);

  if (!model) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No closed trades to plot.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="days"
          name="Held"
          tickFormatter={(value: number) => formatNumber(value, 0)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          minTickGap={28}
          label={{
            value: 'Holding period, days',
            position: 'insideBottom',
            offset: -12,
            fill: palette.mutedText,
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="pnl"
          name="P&L"
          tickFormatter={(value: number) => formatCompact(value)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={52}
        />
        <ZAxis range={[28, 28]} />
        <Tooltip
          cursor={{ stroke: palette.mutedText, strokeDasharray: '3 3' }}
          formatter={(value, name) =>
            name === 'P&L'
              ? [formatCurrency(Number(value ?? 0), 'USD', { maximumFractionDigits: 0 }), 'P&L']
              : [`${formatNumber(Number(value ?? 0), 0)}d`, 'Held']
          }
          contentStyle={{
            background: palette.background,
            border: `1px solid ${palette.grid}`,
            borderRadius: 8,
            color: palette.text,
            fontSize: 12,
          }}
          // Recharts colours each tooltip row from the series colour and
          // falls back to `#000` when there is none to take. A bar coloured
          // by a `<Cell>` has none, so those rows rendered pure black on the
          // dark tooltip. `itemStyle` is spread after that fallback, so it wins.
          itemStyle={{ color: palette.text }}
        />
        <ReferenceLine y={0} stroke={palette.mutedText} strokeOpacity={0.6} />
        <ReferenceLine
          x={model.median}
          stroke={palette.mutedText}
          strokeDasharray="4 3"
          label={{
            value: `Median ${formatNumber(model.median, 0)}d`,
            position: 'insideTopRight',
            fill: palette.mutedText,
            fontSize: 11,
          }}
        />
        <Scatter data={model.points} fillOpacity={0.55} isAnimationActive={false}>
          {model.points.map((point) => (
            <Cell key={point.id} fill={point.pnl >= 0 ? palette.profit : palette.loss} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
