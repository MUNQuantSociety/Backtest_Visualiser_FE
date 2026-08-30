import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { EquityPoint } from '@/features/backtests';
import { formatNumber, formatPercent } from '@/utils/format';
import { drawdownEpisodes } from '@/utils/metrics';

interface DrawdownTableProps {
  data: readonly EquityPoint[];
  /** How many episodes to list, deepest first. */
  limit?: number;
  isLoading?: boolean;
}

/**
 * The worst drawdown episodes as a table: depth, dates, length and recovery.
 *
 * `metrics.maxDrawdown` is one number and hides what actually decides whether a
 * strategy is holdable — how long the hole lasted. Two runs with an identical
 * −18% can be a three-week dip and a nine-month grind, and only one of those
 * gets a trader fired.
 *
 * Pair it with `DrawdownChart`: the chart shows the shape, this gives the
 * durations. An episode that has not made a new high shows a badge and an em
 * dash — its recovery is unknown, not zero, and a number there would read as
 * recovered.
 */
export function DrawdownTable({ data, limit = 5, isLoading = false }: DrawdownTableProps) {
  const episodes = useMemo(() => drawdownEpisodes(data, limit), [data, limit]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (episodes.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No drawdown to report.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="caption-top pb-3 text-left text-xs text-muted-foreground">
          Worst {formatNumber(episodes.length, 0)} peak-to-trough episodes. Length runs peak →
          recovery; recovery runs trough → new high.
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Depth
            </th>
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Peak
            </th>
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Trough
            </th>
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Recovered
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Length
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Recovery
            </th>
          </tr>
        </thead>
        <tbody>
          {episodes.map((episode) => (
            <tr
              key={`${episode.peakDate}-${episode.valleyDate}`}
              className="border-b border-border/40 last:border-0 hover:bg-accent/60"
            >
              <th
                scope="row"
                className="tabular py-2 pr-4 text-right font-mono font-semibold text-loss"
              >
                {formatPercent(episode.depth)}
              </th>
              <td className="tabular py-2 pr-4 font-mono text-muted-foreground">
                {episode.peakDate}
              </td>
              <td className="tabular py-2 pr-4 font-mono text-muted-foreground">
                {episode.valleyDate}
              </td>
              <td className="tabular py-2 pr-4 font-mono">
                {episode.ongoing ? (
                  <Badge variant="outline">underwater</Badge>
                ) : (
                  episode.recoveryDate
                )}
              </td>
              <td className="tabular py-2 pr-4 text-right font-mono">
                {formatNumber(episode.lengthBars, 0)}d
              </td>
              <td className="tabular py-2 text-right font-mono text-muted-foreground">
                {episode.recoveryBars === null ? '—' : `${formatNumber(episode.recoveryBars, 0)}d`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
