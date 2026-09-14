import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { EquityPoint } from '@/features/backtests';
import { formatNumber, formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

import { returnDistribution } from './chart-data';

interface ReturnsDistributionProps {
  data: readonly EquityPoint[];
  /** Total bins across the range, symmetric about zero. */
  bins?: number;
}

/**
 * Daily-return distribution with a normal curve over it and the 95% VaR marked.
 *
 * The normal curve is a visual comparison. The marked 5th percentile is
 * empirical; its calculation makes no normal-distribution assumption.
 *
 * Unlike `histogram()` in utils/metrics, bins here are symmetric about zero
 * rather than edge-forced at it. This is a *shape* chart, and forcing an edge
 * distorts the shape it exists to show — bars are still coloured by sign.
 */
export function ReturnsDistribution({ data, bins = 41 }: ReturnsDistributionProps) {
  const palette = useChartPalette();

  const model = useMemo(() => returnDistribution(data, bins), [data, bins]);

  if (!model) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Not enough history for a return distribution.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={model.buckets} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="midpoint"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(value: number) => formatPercent(value, 1)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          minTickGap={32}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={40}
        />
        <Tooltip
          cursor={{ fill: palette.grid, opacity: 0.25 }}
          formatter={(value, name) =>
            name === 'Days'
              ? [formatNumber(Number(value ?? 0), 0), 'Days']
              : [formatNumber(Number(value ?? 0), 1), 'Normal fit']
          }
          labelFormatter={(_label, payload) => {
            const bucket = payload?.[0]?.payload as { from: number; to: number } | undefined;
            if (!bucket) return '';
            return `${formatPercent(bucket.from, 2)} to ${formatPercent(bucket.to, 2)}`;
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
        <ReferenceLine x={model.mu} stroke={palette.mutedText} strokeOpacity={0.6} />
        <ReferenceLine
          x={model.var95}
          stroke={palette.loss}
          strokeDasharray="4 3"
          label={{
            value: `5th percentile ${formatPercent(model.var95)}`,
            position: 'insideTopLeft',
            fill: palette.mutedText,
            fontSize: 11,
          }}
        />
        <Bar name="Days" dataKey="count" isAnimationActive={false}>
          {model.buckets.map((bucket) => (
            <Cell
              key={String(bucket.from)}
              fill={
                bucket.from < 0 && bucket.to > 0
                  ? palette.neutral
                  : bucket.from >= 0
                    ? palette.profit
                    : palette.loss
              }
            />
          ))}
        </Bar>
        {model.hasNormalFit ? (
          <Line
            name="Normal fit"
            type="monotone"
            dataKey="fit"
            stroke={palette.series[2]}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
