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
import { seriesColor } from '@/lib/chart-theme';
import { formatNumber, formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

export interface ScatterLegendItem {
  label: string;
  colorIndex: number;
}

interface RiskReturnScatterProps {
  backtests: readonly BacktestSummary[];
  /**
   * Colour dots by a category — the strategy, on the dashboard — using the
   * series palette index returned. Undefined falls back to sign colouring.
   */
  colorIndexFor?: ((backtest: BacktestSummary) => number | undefined) | undefined;
  /** What each colour means, shown above the plot. */
  legend?: readonly ScatterLegendItem[] | undefined;
}

/**
 * The part of a run's name that tells it apart from its siblings.
 * "Volatility Momentum · AAPL (lb 40)" → "AAPL (lb 40)"; the strategy is
 * already said by the colour.
 */
function shortLabel(name: string): string {
  const separator = name.indexOf(' · ');
  return separator === -1 ? name : name.slice(separator + 3);
}

/**
 * Which runs get a label: the best Sharpe of each strategy's completed runs.
 *
 * With a few runs every dot can carry its name; with twenty the names pile
 * up into an unreadable smear over the cluster. One label per strategy keeps
 * the plot legible, and the tooltip still names every dot. A failed run's
 * Sharpe over its first bars is not a best, so unfinished runs never win.
 */
function labelledIds(backtests: readonly BacktestSummary[]): Set<string> {
  const best = new Map<string, BacktestSummary>();
  for (const backtest of backtests) {
    if (backtest.status !== 'completed') continue;
    const current = best.get(backtest.strategyId);
    if (!current || backtest.sharpe > current.sharpe) best.set(backtest.strategyId, backtest);
  }
  return new Set([...best.values()].map((backtest) => backtest.id));
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
export function RiskReturnScatter({ backtests, colorIndexFor, legend }: RiskReturnScatterProps) {
  const palette = useChartPalette();
  const labelled = labelledIds(backtests);

  const points = backtests.map((backtest) => ({
    id: backtest.id,
    name: backtest.name,
    label: labelled.has(backtest.id) ? shortLabel(backtest.name) : '',
    colorIndex: colorIndexFor?.(backtest),
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
    <div className="flex h-full flex-col gap-2">
      {legend && legend.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {legend.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: seriesColor(palette, item.colorIndex) }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 32, bottom: 4, left: 0 }}>
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
                borderRadius: 6,
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
                  key={point.id}
                  fill={
                    point.colorIndex === undefined
                      ? point.return >= 0
                        ? palette.profit
                        : palette.loss
                      : seriesColor(palette, point.colorIndex)
                  }
                  fillOpacity={0.75}
                  stroke={palette.background}
                  strokeWidth={1}
                />
              ))}
              <LabelList
                dataKey="label"
                position="right"
                offset={8}
                fill={palette.mutedText}
                fontSize={10}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
