import {
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import type { BacktestSummary } from '@/features/backtests';
import { formatNumber, formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

interface RiskReturnScatterProps {
  backtests: readonly BacktestSummary[];
}

/**
 * Return against risk, one dot per run.
 *
 * The single most useful view across a set of strategies, because it answers
 * the question a ranked list cannot: which runs earned their return cheaply.
 * Up-and-left is better. A strategy sitting far right has paid for its return
 * with a deep hole, and a table sorted by return alone would hide that.
 *
 * Risk here is max drawdown rather than volatility — it is on `BacktestSummary`
 * already, so the chart needs only the list payload and not a detail fetch per
 * point, and drawdown is what actually ends funds.
 */
export function RiskReturnScatter({ backtests }: RiskReturnScatterProps) {
  const palette = useChartPalette();

  const points = backtests.map((backtest) => ({
    name: backtest.name,
    // Plotted as a positive magnitude so the axis reads left-to-right as
    // "safer to riskier"; the sign is restored in the tooltip.
    risk: Math.abs(backtest.maxDrawdown),
    return: backtest.totalReturn,
    sharpe: backtest.sharpe,
    // Sharpe drives dot size, so a big dot up and to the left is unambiguously
    // the best run on the board. Floored so a negative Sharpe still renders.
    weight: Math.max(backtest.sharpe, 0.1),
  }));

  if (points.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No runs to plot.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="risk"
          name="Max drawdown"
          tickFormatter={(value: number) => formatPercent(value, 0)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          label={{
            value: 'Max drawdown →',
            position: 'insideBottomRight',
            offset: -2,
            fill: palette.mutedText,
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="return"
          name="Total return"
          tickFormatter={(value: number) => formatPercent(value, 0)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={56}
        />
        <ZAxis type="number" dataKey="weight" range={[60, 420]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: palette.grid }}
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
          formatter={(value, name) => {
            if (name === 'Max drawdown') return [formatPercent(-Number(value)), name];
            if (name === 'Total return') return [formatPercent(Number(value)), name];
            return [formatNumber(Number(value)), name];
          }}
          labelFormatter={(_label, payload) =>
            (payload?.[0]?.payload as { name?: string } | undefined)?.name ?? ''
          }
        />
        <Scatter data={points} isAnimationActive={false}>
          {points.map((point) => (
            <Cell
              key={point.name}
              fill={point.return >= 0 ? palette.profit : palette.loss}
              fillOpacity={0.65}
              stroke={point.return >= 0 ? palette.profit : palette.loss}
            />
          ))}
          <LabelList
            dataKey="name"
            position="top"
            offset={10}
            fill={palette.mutedText}
            fontSize={10}
          />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
