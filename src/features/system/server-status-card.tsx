import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/format';

import { useSystemStatus } from './system-api';
import type { ServiceState } from './types';

const statePresentation: Record<
  ServiceState,
  { label: string; dot: string; variant: BadgeProps['variant'] }
> = {
  up: { label: 'Up', dot: 'bg-[var(--profit)]', variant: 'profit' },
  degraded: { label: 'Degraded', dot: 'bg-[var(--warning)]', variant: 'outline' },
  down: { label: 'Down', dot: 'bg-[var(--loss)]', variant: 'loss' },
};

const relativeFormat = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

function heartbeatLabel(iso: string | null): string {
  if (iso === null) return 'no heartbeat';
  const secondsAgo = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secondsAgo < 60) return relativeFormat.format(-secondsAgo, 'second');
  return relativeFormat.format(-Math.round(secondsAgo / 60), 'minute');
}

/**
 * "Server Status" from the prototype, per-service rather than one aggregate
 * light. The headline state is the worst of its parts, but the parts stay
 * visible — an operator needs to know *which* thing is unhealthy, and a
 * degraded sentiment daemon is a very different night from a dead executor.
 */
export function ServerStatusCard() {
  const { data, isPending, isError, error } = useSystemStatus();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Server status</CardTitle>
          {data ? (
            <p className="mt-1 text-xs text-muted-foreground">
              v{data.version} · up {formatDuration(data.uptimeSeconds / 86_400)} ·{' '}
              {data.marketOpen ? 'market open' : 'market closed'}
            </p>
          ) : null}
        </div>
        {data ? (
          <Badge variant={statePresentation[data.state].variant}>
            {statePresentation[data.state].label}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent>
        {isPending ? <Skeleton className="h-40" /> : null}

        {isError ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Could not reach the engine. {error.message}
          </p>
        ) : null}

        {data ? (
          <ul className="space-y-2">
            {data.services.map((service) => (
              <li key={service.name} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    statePresentation[service.state].dot,
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{service.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {heartbeatLabel(service.lastHeartbeatAt)}
                    </span>
                  </div>
                  {service.detail ? (
                    <p className="truncate text-xs text-muted-foreground">{service.detail}</p>
                  ) : null}
                  <span className="sr-only">{statePresentation[service.state].label}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
