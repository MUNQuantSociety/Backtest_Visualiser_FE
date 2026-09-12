import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';

import { useDownloadExport } from './backtests-api';
import { EXPORT_FILENAMES, type BacktestDetail, type ExportFilename } from './types';

/** Short labels, because four of these sit in a row beside the run's title. */
const LABELS: Record<ExportFilename, { label: string; hint: string }> = {
  'equity.csv': { label: 'Equity', hint: 'Date, equity and benchmark for every day of the run' },
  'trades.csv': { label: 'Trades', hint: 'One row per FIFO lot, with fees and realised P&L' },
  'metrics.csv': { label: 'Metrics', hint: 'Every metric, and the reason for any that is missing' },
  'report.json': { label: 'JSON', hint: 'The full report exactly as the API returns it' },
};

/**
 * Why a download failed, in terms of the run rather than the transport.
 *
 * The body of a failed request is a `Blob` here, so the api client cannot read
 * the server's `detail` string out of it and falls back to axios's own
 * "Request failed with status code 409". That is true and useless. These are
 * the only two failures the endpoint actually produces.
 */
function explain(error: Error): string {
  if (!(error instanceof ApiError)) return error.message;
  if (error.status === 409) return 'Downloads are ready once the run finishes.';
  if (error.status === 404) return 'This run is no longer on the server.';
  return error.message;
}

/**
 * The run's downloads, for the page header's `actions` slot.
 *
 * Only for a completed run: the endpoint answers 409 before then, and there is
 * no report to export yet. That makes this the exact complement of
 * `RunStatusBanner`, which renders nothing once a run *is* finished — between
 * them the header always says either why there is nothing to read yet or how
 * to take it away.
 */
export function ReportExports({ run }: { run: BacktestDetail }) {
  // Called before the early return because hooks must be unconditional. It
  // holds no subscription, so an unfinished run pays nothing for it.
  const download = useDownloadExport();

  if (run.status !== 'completed') return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Download className="size-4" aria-hidden />
          Download
        </span>

        {EXPORT_FILENAMES.map((filename) => {
          const { label, hint } = LABELS[filename];
          // `variables` is the argument the in-flight mutation was called with,
          // which is how one mutation hook drives four buttons: only the button
          // whose file is being fetched reports itself as busy.
          const busy = download.isPending && download.variables?.filename === filename;

          return (
            <Button
              key={filename}
              variant="outline"
              size="sm"
              disabled={download.isPending}
              title={hint}
              onClick={() => {
                download.mutate({ id: run.id, filename });
              }}
            >
              {busy ? 'Saving…' : label}
            </Button>
          );
        })}
      </div>

      {download.isError ? (
        <p className="text-xs text-[var(--loss)]" role="alert">
          {explain(download.error)}
        </p>
      ) : null}
    </div>
  );
}
