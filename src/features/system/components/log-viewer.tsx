import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LOG_LEVELS, type LogLevel } from '@/config/constants';
import { cn } from '@/lib/utils';

import { useLogTail } from '../hooks/use-system';

const levelClass: Record<LogLevel, string> = {
  DEBUG: 'text-muted-foreground',
  INFO: 'text-foreground',
  WARNING: 'text-[var(--warning)]',
  ERROR: 'text-[var(--loss)]',
  CRITICAL: 'text-[var(--loss)] font-semibold',
};

const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Tail of the live engine's Python log.
 *
 * The level filter is a floor, not an exact match: picking WARNING shows
 * warnings, errors and criticals. `LOG_LEVELS` is ordered by severity for
 * exactly this reason, so the comparison is an index test rather than a lookup
 * table that has to be kept in sync.
 */
export function LogViewer() {
  const [minLevel, setMinLevel] = useState<LogLevel>('INFO');
  const { data, isPending, isError, error } = useLogTail();

  const entries = useMemo(() => {
    if (!data) return [];
    const floor = LOG_LEVELS.indexOf(minLevel);
    return data.entries.filter((entry) => LOG_LEVELS.indexOf(entry.level) >= floor);
  }, [data, minLevel]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Minimum level</span>
        {LOG_LEVELS.map((level) => (
          <Button
            key={level}
            size="sm"
            variant={level === minLevel ? 'secondary' : 'ghost'}
            aria-pressed={level === minLevel}
            onClick={() => {
              setMinLevel(level);
            }}
          >
            {level}
          </Button>
        ))}
      </div>

      {isPending ? <Skeleton className="h-96" /> : null}

      {isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{error.message}</p>
      ) : null}

      {data && entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing at {minLevel} or above in the current tail.
        </p>
      ) : null}

      {entries.length > 0 ? (
        <div
          className="max-h-[32rem] overflow-auto rounded-md border bg-muted/30"
          role="log"
          aria-live="polite"
          aria-label="Engine log"
        >
          <table className="w-full font-mono text-xs">
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="tabular w-20 px-3 py-1.5 align-top text-muted-foreground">
                    {timeFormat.format(new Date(entry.timestamp))}
                  </td>
                  <td className={cn('w-20 px-2 py-1.5 align-top', levelClass[entry.level])}>
                    {entry.level}
                  </td>
                  <td className="w-44 truncate px-2 py-1.5 align-top text-muted-foreground">
                    {entry.logger}
                  </td>
                  <td className={cn('px-2 py-1.5 align-top', levelClass[entry.level])}>
                    {entry.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data?.truncated ? (
        <p className="text-xs text-muted-foreground">
          Showing the most recent {data.entries.length} lines. Older entries are on the host.
        </p>
      ) : null}
    </div>
  );
}
