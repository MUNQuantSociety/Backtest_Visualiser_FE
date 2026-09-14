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

import { TRADING_DAYS_PER_YEAR } from '@/config/constants';
import type { EquityPoint } from '@/features/backtests';
import { formatNumber, formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

import { benchmarkRegression } from './chart-data';

interface BetaScatterProps {
  data: readonly EquityPoint[];
  benchmarkLabel?: string;
}

/** Raw daily-return OLS with an arithmetic annualised intercept (not CAPM alpha). */
export function BetaScatter({ data, benchmarkLabel = 'Buy & hold' }: BetaScatterProps) {
  const palette = useChartPalette();

  const model = useMemo(() => benchmarkRegression(data), [data]);

  if (!model) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Regression needs at least 8 paired daily returns and a benchmark that changes.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <dl className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">α (ann.)</dt>
          <dd
            className={`tabular font-mono font-medium ${model.fit.alpha >= 0 ? 'text-profit' : 'text-loss'}`}
          >
            {formatPercent(model.fit.alpha * TRADING_DAYS_PER_YEAR)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">β</dt>
          <dd className="tabular font-mono font-medium">{formatNumber(model.fit.beta)}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">R²</dt>
          <dd className="tabular font-mono font-medium">{formatNumber(model.fit.r2)}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">n</dt>
          <dd className="tabular font-mono font-medium">{formatNumber(model.points.length, 0)}</dd>
        </div>
      </dl>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="benchmark"
              name={benchmarkLabel}
              tickFormatter={(value: number) => formatPercent(value, 1)}
              tick={{ fill: palette.mutedText, fontSize: 11 }}
              stroke={palette.grid}
              minTickGap={32}
              label={{
                value: `${benchmarkLabel} daily return`,
                position: 'insideBottom',
                offset: -12,
                fill: palette.mutedText,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="strategy"
              name="Strategy"
              tickFormatter={(value: number) => formatPercent(value, 1)}
              tick={{ fill: palette.mutedText, fontSize: 11 }}
              stroke={palette.grid}
              width={52}
            />
            <ZAxis range={[18, 18]} />
            <Tooltip
              cursor={{ stroke: palette.mutedText, strokeDasharray: '3 3' }}
              formatter={(value, name) => [formatPercent(Number(value ?? 0), 2), String(name)]}
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
            {/* The four quadrants are the whole reading. */}
            <ReferenceLine x={0} stroke={palette.mutedText} strokeOpacity={0.45} />
            <ReferenceLine y={0} stroke={palette.mutedText} strokeOpacity={0.45} />
            <Scatter data={model.points} fillOpacity={0.55} isAnimationActive={false}>
              {model.points.map((point) => (
                <Cell key={point.date} fill={point.strategy >= 0 ? palette.profit : palette.loss} />
              ))}
            </Scatter>
            <Scatter
              data={model.fitLine}
              line={{ stroke: palette.series[0], strokeWidth: 2 }}
              shape={() => <g />}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
