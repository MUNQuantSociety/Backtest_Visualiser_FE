import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { useStrategies } from '../strategies-api';
import type { Strategy } from '../types';

const statusVariant = {
  active: 'default',
  draft: 'secondary',
  archived: 'outline',
} as const;

/** The catalogue: what exists, and how its runs have gone. */
export function StrategyList() {
  const { data, isPending, isError, error } = useStrategies();

  if (isError) {
    return <EmptyState title="Could not load strategies" description={error.message} />;
  }

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_unused, index) => (
          <Skeleton key={index} className="h-44" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title="No strategies yet" description="Add one with the editor above." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((strategy) => (
        <StrategyCard key={strategy.id} strategy={strategy} />
      ))}
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const hasRuns = strategy.runCount > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-base">{strategy.name}</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">{strategy.className}</p>
        </div>
        <Badge variant={statusVariant[strategy.status]}>{strategy.status}</Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">{strategy.description}</p>

        <div className="flex flex-wrap gap-1">
          {strategy.tags.map((tag) => (
            <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>

        <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Runs</dt>
            <dd className="font-medium">{formatNumber(strategy.runCount, 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Best Sharpe</dt>
            <dd className="font-medium">
              {strategy.bestSharpe === null ? '—' : formatNumber(strategy.bestSharpe)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Best return</dt>
            <dd
              className={
                strategy.bestReturn === null
                  ? 'font-medium'
                  : toneFromValue(strategy.bestReturn) === 'profit'
                    ? 'font-medium text-[var(--profit)]'
                    : 'font-medium text-[var(--loss)]'
              }
            >
              {strategy.bestReturn === null
                ? '—'
                : formatSigned(strategy.bestReturn, (n) => formatPercent(n))}
            </dd>
          </div>
        </dl>

        {/* A strategy's runs are its backtests filtered by id — a link, not a
            separate endpoint. Untested strategies say so rather than linking
            to an empty list. */}
        {hasRuns ? (
          <Link
            to={`${paths.backtests}?strategyId=${encodeURIComponent(strategy.id)}`}
            className="inline-block text-sm text-primary hover:underline"
          >
            View {strategy.runCount} run{strategy.runCount === 1 ? '' : 's'} →
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Never tested</p>
        )}
      </CardContent>
    </Card>
  );
}
