import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { SectorExposure } from '../types';

const GRID = '124px 56px minmax(0,1fr) 56px 52px minmax(0,0.9fr) 64px';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

interface SectorExposureTableProps {
  sectors: readonly SectorExposure[];
  isLoading?: boolean | undefined;
}

/**
 * Long and short as a share of NAV per sector, and what each added or cost
 * this month.
 *
 * Exposure is not P&L, so the exposure bars use the two series colours rather
 * than profit and loss. Attribution is money, so its bar and figure are signed.
 */
export function SectorExposureTable({ sectors, isLoading = false }: SectorExposureTableProps) {
  if (isLoading && sectors.length === 0) return <Skeleton className="h-48" />;

  const exposurePeak = Math.max(
    ...sectors.map((sector) => Math.max(sector.long, sector.short)),
    0.01,
  );
  const attributionPeak = Math.max(
    ...sectors.map((sector) => Math.abs(sector.mtdAttributionBps)),
    1,
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="mb-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ background: 'var(--chart-1)' }}
              aria-hidden
            />
            Long
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ background: 'var(--chart-2)' }}
              aria-hidden
            />
            Short
          </span>
        </div>
        <div
          className="grid gap-x-2 border-b pb-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Sector</span>
          <span className="text-right">Short</span>
          <span />
          <span className="text-right">Long</span>
          <span className="text-right">Net</span>
          <span />
          <span className="text-right">MTD attr.</span>
        </div>
        {sectors.map((sector) => (
          <div
            key={sector.sector}
            className="grid items-center gap-x-2 border-b py-2 text-xs last:border-b-0"
            style={{ gridTemplateColumns: GRID }}
          >
            <span className="truncate font-medium">{sector.sector}</span>
            <span className="tabular text-right text-muted-foreground">
              {sector.short === 0 ? '—' : formatPercent(sector.short, 1)}
            </span>
            <ExposureBar long={sector.long} short={sector.short} peak={exposurePeak} />
            <span className="tabular text-right">{formatPercent(sector.long, 1)}</span>
            <span className="tabular text-right">
              {formatSigned(sector.net, (n) => formatPercent(n, 1))}
            </span>
            <AttributionBar value={sector.mtdAttributionBps} peak={attributionPeak} />
            <span
              className={cn(
                'tabular text-right',
                toneClass[toneFromValue(sector.mtdAttributionBps)],
              )}
            >
              {formatSigned(sector.mtdAttributionBps, (n) => `${formatNumber(n, 0)} bps`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Short grows left from the centre, long grows right; both share one scale. */
function ExposureBar({ long, short, peak }: { long: number; short: number; peak: number }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-muted" aria-hidden>
      <span className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border-strong)]" />
      <span
        className="absolute top-0 right-1/2 bottom-0 rounded-l-full"
        style={{ width: `${String((short / peak) * 50)}%`, background: 'var(--chart-2)' }}
      />
      <span
        className="absolute top-0 bottom-0 left-1/2 rounded-r-full"
        style={{ width: `${String((long / peak) * 50)}%`, background: 'var(--chart-1)' }}
      />
    </div>
  );
}

/** Signed bar from the centre: money, so it is coloured by sign. */
function AttributionBar({ value, peak }: { value: number; peak: number }) {
  const width = `${String((Math.abs(value) / peak) * 50)}%`;
  return (
    <div className="relative h-2 w-full rounded-full bg-muted" aria-hidden>
      <span className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border-strong)]" />
      <span
        className={cn(
          'absolute top-0 bottom-0',
          value >= 0 ? 'left-1/2 rounded-r-full' : 'right-1/2 rounded-l-full',
        )}
        style={{ width, background: value >= 0 ? 'var(--profit)' : 'var(--loss)' }}
      />
    </div>
  );
}
