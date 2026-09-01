import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { EquityPoint } from '@/features/backtests';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/format';
import { monthlyReturns } from '@/utils/metrics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthlyReturnsHeatmapProps {
  data: readonly EquityPoint[];
  isLoading?: boolean;
}

/**
 * Calendar-month returns as a year × month grid with a YTD column — the most
 * recognisable panel on a quant tearsheet, and the fastest read on whether a
 * strategy's edge is persistent or three good months.
 *
 * A table, not a chart: every cell is a scalar a reader wants to compare against
 * its neighbours both across and down, which is what a table does and no
 * visualisation does better.
 *
 * Two conventions worth keeping:
 *
 * 1. **Shading is scaled to the largest absolute month in this grid**, so a calm
 *    year is not washed out by one violent month elsewhere in the table. The
 *    consequence is that two heatmaps are not comparable by colour — say so if
 *    you ever show two side by side.
 * 2. **The YTD column is never shaded.** It is a different quantity from a month
 *    and must not be read on the same ramp.
 *
 * Alpha is applied with `color-mix` rather than a `--chart-N` slot: this is a
 * magnitude ramp on a domain token, not a series.
 */
export function MonthlyReturnsHeatmap({ data, isLoading = false }: MonthlyReturnsHeatmapProps) {
  const rows = useMemo(() => monthlyReturns(data), [data]);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (rows.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Not enough history for a monthly breakdown.
      </p>
    );
  }

  const peak = Math.max(
    ...rows.flatMap((row) =>
      row.months.filter((value): value is number => value !== null).map(Math.abs),
    ),
    0.01,
  );

  const cellStyle = (value: number | null) => {
    if (value === null) return undefined;
    const token = value >= 0 ? 'var(--profit)' : 'var(--loss)';
    const strength = Math.round(Math.min(Math.abs(value) / peak, 1) * 62);
    return { background: `color-mix(in oklab, ${token} ${String(strength)}%, transparent)` };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <caption className="caption-top pb-3 text-left text-xs text-muted-foreground">
          Compounded return per calendar month. Shading is scaled to the largest month in this grid;
          the YTD column is not shaded — it is a different quantity.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pb-1.5" />
            {MONTHS.map((month) => (
              <th
                key={month}
                scope="col"
                className="pb-1.5 text-center font-mono text-xs font-medium text-muted-foreground"
              >
                {month}
              </th>
            ))}
            <th
              scope="col"
              className="border-l border-border pb-1.5 pl-2 text-right font-mono text-xs font-medium text-muted-foreground"
            >
              YTD
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <th
                scope="row"
                className="pr-2 text-right font-mono text-xs font-medium text-muted-foreground"
              >
                {row.year}
              </th>
              {row.months.map((value, index) => (
                <td key={MONTHS[index]} className="p-0">
                  <div
                    className="tabular flex h-8 items-center justify-center rounded-sm font-mono"
                    style={cellStyle(value)}
                    title={
                      value === null
                        ? `${MONTHS[index] ?? ''} ${row.year}: no data`
                        : `${MONTHS[index] ?? ''} ${row.year}: ${formatPercent(value)}`
                    }
                  >
                    {value === null ? (
                      <span className="text-muted-foreground">·</span>
                    ) : (
                      formatPercent(value, 1)
                    )}
                  </div>
                </td>
              ))}
              <td className="border-l border-border p-0">
                <div
                  className={cn(
                    'tabular flex h-8 items-center justify-end pl-2 font-mono font-semibold',
                    row.ytd >= 0 ? 'text-profit' : 'text-loss',
                  )}
                >
                  {formatPercent(row.ytd, 1)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
