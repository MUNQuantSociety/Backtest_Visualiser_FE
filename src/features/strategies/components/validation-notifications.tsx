import { CircleCheck, CircleX, Loader2, X } from 'lucide-react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { SubmissionRecord } from '../submissions';
import { useSubmissions } from '../use-submissions';

/**
 * Standing notice for every upload this browser is waiting on.
 *
 * Mounted in the shell rather than in the editor, and backed by
 * `localStorage`, because the two moments that matter are the ones the editor
 * cannot cover: the author navigates away while validation runs, or closes the
 * window entirely. Both used to end with a strategy that had quietly failed
 * and left no trace anywhere in the UI.
 *
 * A failure stays until it is dismissed. That is deliberate — it is the only
 * account of why the strategy is not selectable, and the error text is the
 * engine's, not a paraphrase.
 */
export function ValidationNotifications() {
  const { unacknowledged, acknowledge } = useSubmissions();

  if (unacknowledged.length === 0) return null;

  return (
    <div className="space-y-2">
      {unacknowledged.map((record) => (
        <Notice key={record.strategyKey} record={record} onDismiss={acknowledge} />
      ))}
    </div>
  );
}

function Notice({
  record,
  onDismiss,
}: {
  record: SubmissionRecord;
  onDismiss: (strategyKey: string) => void;
}) {
  const failed = record.outcome === 'failed';
  const pending = record.outcome === 'pending';

  return (
    <div
      // Assertive only for a failure: something has to be fixed, and the author
      // is by then most likely reading their own code on another page.
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        failed
          ? 'border-[var(--loss)]/40 text-[var(--loss)]'
          : record.outcome === 'passed'
            ? 'border-[var(--profit)]/40 text-[var(--profit)]'
            : 'border-border text-muted-foreground'
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : failed ? (
          <CircleX className="size-4" aria-hidden />
        ) : (
          <CircleCheck className="size-4" aria-hidden />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {pending ? (
          <span>
            <strong>Validating “{record.name || record.strategyKey}”…</strong> It stays a draft
            until the run proves it loads and trades. You can leave this page; the result is kept.
          </span>
        ) : failed ? (
          <>
            <span className="flex flex-wrap items-center gap-2">
              <strong>“{record.name || record.strategyKey}” failed validation.</strong>
              <Badge variant="destructive">draft · failed</Badge>
            </span>
            <span>It stays in your drafts and cannot be run until it passes.</span>
            <code className="block overflow-x-auto rounded bg-background px-2 py-1 font-mono text-xs">
              {record.errorMessage ?? 'No reason was recorded for the failure.'}
            </code>
            {record.validationRunId ? (
              <Link
                to={paths.backtestDetail(record.validationRunId)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Open the validation run →
              </Link>
            ) : null}
          </>
        ) : (
          <span>
            <strong>“{record.name || record.strategyKey}” passed validation and is active.</strong>{' '}
            It can be selected in the run dialog now.
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Dismiss the notice for ${record.name || record.strategyKey}`}
        onClick={() => {
          onDismiss(record.strategyKey);
        }}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
