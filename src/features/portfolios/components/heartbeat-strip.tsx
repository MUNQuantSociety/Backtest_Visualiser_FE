import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useSystemStatus, type ServiceState } from '@/features/system';
import { cn } from '@/lib/utils';

const dotClass: Record<ServiceState, string> = {
  up: 'bg-[var(--profit)]',
  degraded: 'bg-[var(--warning)]',
  down: 'bg-[var(--loss)]',
};

/** Exchange time — the clock the engine and the log run on. */
const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

function heartbeatAge(iso: string | null, now: number): string {
  if (iso === null) return 'no heartbeat';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${String(seconds)}s`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))}m`;
  return `${String(Math.round(seconds / 3600))}h`;
}

/**
 * The engine's pulse, in the header where nothing below it is trusted
 * without one. A service that stopped beating shows its age climbing, which
 * a static green dot never would.
 */
export function HeartbeatStrip() {
  const { data, isPending, isError } = useSystemStatus();
  const now = useNow();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-card px-4 py-2 text-[11px]">
      <span className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        Engine
      </span>
      {isPending ? <Skeleton className="h-3.5 w-72" /> : null}
      {isError ? <span className="text-[var(--loss)]">status endpoint unreachable</span> : null}
      {data?.services.map((service) => (
        <span
          key={service.name}
          className="tabular flex items-center gap-1.5"
          title={service.detail ?? service.label}
        >
          <span
            className={cn('inline-block size-1.5 rounded-full', dotClass[service.state])}
            aria-hidden
          />
          <span>{service.name}</span>
          <span
            className={cn(
              'text-muted-foreground',
              service.state !== 'up' && 'text-[var(--warning)]',
            )}
          >
            {heartbeatAge(service.lastHeartbeatAt, now)}
          </span>
        </span>
      ))}
      <span className="tabular ml-auto text-muted-foreground">
        {data ? (data.marketOpen ? 'NYSE open' : 'NYSE closed') : 'NYSE'} ·{' '}
        {clockFormat.format(now)} ET
      </span>
    </div>
  );
}
