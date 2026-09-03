import { X } from 'lucide-react';
import { useRef, useState } from 'react';

import { DemoBadge } from '@/components/common/demo-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber, formatPercent, formatSigned } from '@/utils/format';

import { useRisk } from '../portfolios-api';

const asOfFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
});

interface RiskReportDialogProps {
  /** Master NAV, so each ratio can also be shown as money. */
  nav: number;
}

/**
 * The book's risk report, on demand rather than on the page: VaR is one
 * number an operator checks and eight they check when something is wrong.
 */
export function RiskReportDialog({ nav }: RiskReportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const { data, isPending, isError } = useRisk();

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setOpen(true);
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  const pct = (value: number) => formatPercent(value, 2);
  const money = (value: number) => formatCurrency(value * nav);
  const rows: [string, string, string][] = data
    ? [
        ['1-day VaR (95%)', pct(data.var95), money(data.var95)],
        ['1-day VaR (99%)', pct(data.var99), money(data.var99)],
        [
          'Expected shortfall (95%)',
          pct(data.expectedShortfall95),
          money(data.expectedShortfall95),
        ],
        [
          'Gross exposure',
          `${formatNumber(data.grossExposure, 2)}× NAV`,
          money(data.grossExposure),
        ],
        [
          'Net exposure',
          formatSigned(data.netExposure, (n) => formatPercent(n, 1)),
          formatSigned(data.netExposure, (n) => formatCurrency(n * nav)),
        ],
        ['Leverage', `${formatNumber(data.leverage, 2)}×`, ''],
        ['Beta to SPY', formatNumber(data.betaToSpy, 2), ''],
        ['Largest name', pct(data.maxNameWeight), money(data.maxNameWeight)],
      ]
    : [];

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        Risk report
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="risk-report-title"
        onClose={() => {
          setOpen(false);
        }}
        onClick={(event) => {
          const dialog = dialogRef.current;
          if (!dialog || event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          const inside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
          if (!inside) closeDialog();
        }}
        className="m-auto max-h-[calc(100vh-2rem)] w-[min(480px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/85"
      >
        {open ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="risk-report-title"
                  className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
                >
                  Risk report <DemoBadge />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ratios of NAV, with what they mean in money at today&apos;s NAV.
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={closeDialog}>
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            {isPending ? <Skeleton className="h-48" /> : null}
            {isError ? (
              <p className="text-sm text-[var(--loss)]">The risk endpoint did not answer.</p>
            ) : null}
            {data ? (
              <div className="text-sm">
                {rows.map(([label, value, asMoney]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[minmax(0,1fr)_96px_112px] items-center gap-3 border-b py-2 last:border-b-0"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular text-right font-medium">{value}</span>
                    <span className="tabular text-right text-muted-foreground">{asMoney}</span>
                  </div>
                ))}
                <p className="tabular pt-3 text-[11px] text-muted-foreground">
                  Historical simulation over {String(data.lookbackDays)} sessions · as of{' '}
                  {asOfFormat.format(new Date(data.asOf))} ET
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
