import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCompact, formatCurrency, formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

export interface Contributor {
  name: string;
  value: number;
}

interface ContributionWaterfallProps {
  contributors: readonly Contributor[];
  /** Label for the closing column. */
  totalLabel?: string;
}

/**
 * P&L attribution as a waterfall: each contributor is a floating bar starting
 * where the previous one ended, closing on a total column.
 *
 * A pie of positive contributions cannot show a name that lost money, and a
 * plain bar chart cannot show that four winners were half-cancelled by one
 * loser. The waterfall shows both, which is why every risk report uses one.
 *
 * Contributors arrive in the caller's order and are **not** re-sorted:
 * attribution read left-to-right in magnitude order tells a different story from
 * the same numbers in book order, and the caller owns that choice.
 *
 * Implemented as a stacked bar with an invisible base — Recharts has no
 * waterfall primitive, and a transparent riser is how the floating segment is
 * achieved without a custom shape.
 */
export function ContributionWaterfall({
  contributors,
  totalLabel = 'Net P&L',
}: ContributionWaterfallProps) {
  const palette = useChartPalette();

  const rows = useMemo(() => {
    // Built with an explicit loop rather than `map` over a closed-over running
    // total: the compiler's immutability rule rejects reassigning a captured
    // binding inside a render callback, since the callback can outlive the
    // render that created it. A local accumulator never leaves this block.
    let running = 0;
    const steps = [];

    for (const contributor of contributors) {
      const base = contributor.value >= 0 ? running : running + contributor.value;
      steps.push({
        name: contributor.name,
        base,
        magnitude: Math.abs(contributor.value),
        value: contributor.value,
        isTotal: false,
      });
      running += contributor.value;
    }

    return [
      ...steps,
      {
        name: totalLabel,
        base: Math.min(0, running),
        magnitude: Math.abs(running),
        value: running,
        isTotal: true,
      },
    ];
  }, [contributors, totalLabel]);

  if (rows.length <= 1) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No attribution to show.
      </p>
    );
  }

  const total = rows[rows.length - 1]?.value ?? 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          interval={0}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompact(value)}
          tick={{ fill: palette.mutedText, fontSize: 11 }}
          stroke={palette.grid}
          width={56}
        />
        <Tooltip
          cursor={{ fill: palette.grid, opacity: 0.25 }}
          formatter={(_value, _name, item) => {
            const row = item.payload as { value: number; isTotal: boolean } | undefined;
            if (!row) return ['', ''];
            const amount = formatCurrency(row.value, 'USD', { maximumFractionDigits: 0 });
            if (row.isTotal || total === 0) return [amount, 'Contribution'];
            return [`${amount} (${formatPercent(row.value / total, 1)} of net)`, 'Contribution'];
          }}
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
        <ReferenceLine y={0} stroke={palette.mutedText} />
        {/* Invisible riser lifts each bar to where the previous one ended. */}
        <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
        <Bar
          dataKey="magnitude"
          stackId="waterfall"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        >
          {rows.map((row) => (
            <Cell
              key={row.name}
              fill={
                row.isTotal ? palette.series[0] : row.value >= 0 ? palette.profit : palette.loss
              }
            />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
