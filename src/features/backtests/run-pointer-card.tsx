import { ArrowUpRight, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { RunValueAt } from './benchmark-book';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

const signedPercent = (value: number) => formatSigned(value, (n) => formatPercent(n, 1));

interface RunPointerCardProps {
  /** The date under the pointer. */
  date: string;
  rows: readonly RunValueAt[];
  /** "SPY" or "Buy & hold", for the lead's label. */
  benchmarkTitle: string;
  /** Each run's line colour, so a row matches its line. */
  colorFor: (runId: string) => string;
  /**
   * Pinned by a click: it stops following the pointer, takes clicks so its
   * links work, and shows a close button. Unpinned it only follows.
   */
  pinned: boolean;
  onClose: () => void;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * The comparison chart's pointer readout: each run's portfolio value, its
 * return since the window began and its lead over the benchmark at one date,
 * with a link to the run.
 */
export function RunPointerCard({
  date,
  rows,
  benchmarkTitle,
  colorFor,
  pinned,
  onClose,
  className,
  style,
}: RunPointerCardProps) {
  return (
    <section
      aria-label={`Run values on ${date}`}
      className={cn(
        'w-64 rounded-md border border-[var(--border-strong)] bg-card px-3 py-2.5 text-xs text-card-foreground shadow-[0_18px_40px_rgb(0_0_0/0.45)]',
        pinned ? 'pointer-events-auto' : 'pointer-events-none',
        className,
      )}
      style={style}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="tabular text-[11px] font-medium text-muted-foreground">{date}</h3>
        {pinned ? (
          <Button
            variant="ghost"
            size="icon"
            className="-my-1 -mr-1.5 size-6 text-muted-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">Click to pin</span>
        )}
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} aria-label={row.name} className="flex gap-2">
            <span
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ background: colorFor(row.id) }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{row.name}</span>
                <Link
                  to={paths.backtestDetail(row.id)}
                  aria-label={`Open ${row.name}`}
                  title={`Open ${row.name}`}
                  className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  tabIndex={pinned ? 0 : -1}
                >
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              {row.value === null || row.returnSinceStart === null ? (
                <p className="text-muted-foreground">Not started</p>
              ) : (
                <p className="tabular flex flex-wrap items-baseline gap-x-2">
                  <span>{formatCurrency(row.value)}</span>
                  <span className={toneClass[toneFromValue(row.returnSinceStart)]}>
                    {signedPercent(row.returnSinceStart)}
                  </span>
                  <span
                    className={cn(
                      'text-[11px]',
                      row.lead === null
                        ? 'text-muted-foreground'
                        : toneClass[toneFromValue(row.lead)],
                    )}
                  >
                    {row.lead === null
                      ? `no ${benchmarkTitle} price`
                      : `${signedPercent(row.lead)} vs ${benchmarkTitle}`}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
