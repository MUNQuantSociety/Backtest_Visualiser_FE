import { useMemo } from 'react';

import type { EquityPoint } from '@/features/backtests';
import { formatPercent, formatSigned } from '@/utils/format';
import { monthlyReturns } from '@/utils/metrics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthlyDifferenceHeatmapProps {
  a: readonly EquityPoint[];
  b: readonly EquityPoint[];
  aLabel?: string | undefined;
  bLabel?: string | undefined;
}

/**
 * A's monthly return minus B's, year by month.
 *
 * Blue months A won, amber months B won. A run that wins on total return but
 * loses most months is winning on a few outliers, and that is the single most
 * useful thing to know before trusting the total. Shading uses the two series
 * colours rather than profit/loss: neither run "made money" here, one merely
 * beat the other.
 */
export function MonthlyDifferenceHeatmap({
  a,
  b,
  aLabel = 'A',
  bLabel = 'B',
}: MonthlyDifferenceHeatmapProps) {
  const rows = useMemo(() => {
    const byYear = new Map<string, { a: (number | null)[]; b: (number | null)[] }>();
    for (const row of monthlyReturns(a)) {
      byYear.set(row.year, { a: row.months, b: Array.from({ length: 12 }, () => null) });
    }
    for (const row of monthlyReturns(b)) {
      const entry = byYear.get(row.year) ?? {
        a: Array.from({ length: 12 }, () => null),
        b: Array.from({ length: 12 }, () => null),
      };
      entry.b = row.months;
      byYear.set(row.year, entry);
    }
    return [...byYear.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([year, entry]) => ({
        year,
        months: entry.a.map((va, i) => {
          const vb = entry.b[i] ?? null;
          return va === null || vb === null ? null : va - vb;
        }),
      }));
  }, [a, b]);

  if (rows.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Not enough shared history for a monthly breakdown.
      </p>
    );
  }

  const peak = Math.max(
    ...rows.flatMap((row) =>
      row.months.filter((value): value is number => value !== null).map(Math.abs),
    ),
    0.005,
  );

  const cellStyle = (value: number | null) => {
    if (value === null) return undefined;
    const token = value >= 0 ? 'var(--chart-1)' : 'var(--chart-2)';
    const strength = Math.round(Math.min(Math.abs(value) / peak, 1) * 62);
    return { background: `color-mix(in oklab, ${token} ${String(strength)}%, transparent)` };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th scope="col" className="pb-1.5" />
            {MONTHS.map((month) => (
              <th
                key={month}
                scope="col"
                className="tabular pb-1.5 text-center text-xs font-medium text-muted-foreground"
              >
                {month}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <th
                scope="row"
                className="tabular pr-2 text-right text-xs font-medium text-muted-foreground"
              >
                {row.year}
              </th>
              {row.months.map((value, index) => (
                <td key={MONTHS[index]} className="p-0">
                  <div
                    className="tabular flex h-[30px] items-center justify-center rounded-[3px]"
                    style={cellStyle(value)}
                    title={
                      value === null
                        ? `${MONTHS[index] ?? ''} ${row.year}: no shared data`
                        : `${MONTHS[index] ?? ''} ${row.year}: ${aLabel} − ${bLabel} = ${formatSigned(value, (n) => formatPercent(n))}`
                    }
                  >
                    {value === null ? (
                      <span className="text-muted-foreground">·</span>
                    ) : (
                      formatSigned(value, (n) => formatPercent(n, 1))
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
