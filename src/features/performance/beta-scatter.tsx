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
import { ols, toReturns } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface BetaScatterProps {
  data: readonly EquityPoint[];
  benchmarkLabel?: string;
}

/**
 * Daily strategy return against daily benchmark return, with the OLS fit drawn
 * through it and alpha, beta and R² read out above the plot.
 *
 * This answers the only question a benchmark comparison really asks: is the
 * strategy earning a return the index was not already handing out? Beta near 1
 * with a high R² means the equity curve is the market wearing a different name,
 * however good the Sharpe looks. Beta near 0 with positive alpha is the thing
 * worth allocating to.
 *
 * Alpha is annualised for display — a daily intercept is a number nobody can
 * hold in their head. Beta and R² are unitless and left alone.
 */
export function BetaScatter({ data, benchmarkLabel = 'Buy & hold' }: BetaScatterProps) {
  const palette = useChartPalette();

  const model = useMemo(() => {
    const usable = data.filter(
      (point) => point.benchmark !== null && point.benchmark !== undefined,
    );
    if (usable.length < 8) return null;

    const strategy = toReturns(usable.map((point) => point.equity));
    const benchmark = toReturns(usable.map((point) => point.benchmark ?? point.equity));
    const fit = ols(benchmark, strategy);

    const points = strategy.map((value, index) => ({
      strategy: value,
      benchmark: benchmark[index] ?? 0,
      date: usable[index + 1]?.date ?? '',
    }));

    const xs = points.map((point) => point.benchmark);
    const min = Math.min(...xs);
    const max = Math.max(...xs);

    return {
      fit,
      points,
      // Two points are enough to place the regression line.
      fitLine: [
        { benchmark: min, strategy: fit.alpha + fit.beta * min },
        { benchmark: max, strategy: fit.alpha + fit.beta * max },
      ],
    };
  }, [data]);

  if (!model) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No benchmark series to regress against.
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
                borderRadius: 8,
                color: palette.text,
                fontSize: 12,
              }}
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
