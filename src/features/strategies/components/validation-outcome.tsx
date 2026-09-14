import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Badge } from '@/components/ui/badge';

import { useStrategyStatus } from '../strategies-api';
import type { StrategySubmissionResult } from '../types';

/**
 * What became of the validation run a save started.
 *
 * Saving answers `draft` and queues a backtest that proves the source runs.
 * Until that finishes nothing else says so, and a failure is invisible: the
 * strategy stays a draft, and the catalogue lists active strategies only, so
 * the row vanishes from the Library. That reads as a save that did nothing —
 * which is exactly what happened to the first hand-written upload, whose
 * source subclassed `BasePortfolio` without importing it.
 *
 * The strategy registry is polled instead of the backtest detail endpoint.
 * Validation jobs are transient and failed jobs may never have a saved report,
 * while the strategy row retains the authoritative lifecycle state.
 */
export function ValidationOutcome({ result }: { result: StrategySubmissionResult }) {
  const strategy = useStrategyStatus(result.validationRunId ? result.id : undefined);

  // Nothing to watch: the save went through but no run was started, and the
  // server's own message is the only account of why.
  if (!result.validationRunId) {
    return (
      <Panel tone="warn" icon={<CircleX className="size-4" aria-hidden />} alert>
        <strong>Saved as a draft, not validated.</strong> No validation run was started, so this
        strategy cannot be selected yet.
        {result.message ? <> {result.message}</> : null}
      </Panel>
    );
  }

  // An error with data behind it is a stale poll, not an unreadable run:
  // the ladder below keeps showing the last state that was read.
  if (strategy.isError && strategy.data === undefined) {
    return (
      <Panel tone="warn" icon={<CircleX className="size-4" aria-hidden />} alert>
        <strong>Saved as a draft.</strong> Its validation run could not be read:{' '}
        {strategy.error.message}
      </Panel>
    );
  }

  const status = strategy.data?.validationState;

  if (strategy.data === undefined || status === 'validating') {
    return (
      <Panel tone="muted" icon={<Loader2 className="size-4 animate-spin" aria-hidden />}>
        <strong>Validating “{result.name}”…</strong> It stays a draft until this run proves it loads
        and trades. This takes as long as a backtest does.
      </Panel>
    );
  }

  if (status === 'failed_validation') {
    return (
      <Panel tone="loss" icon={<CircleX className="size-4" aria-hidden />} alert>
        <span className="flex flex-wrap items-center gap-2">
          <strong>Validation failed — “{result.name}” is saved as a draft.</strong>
          <Badge variant="destructive">failed validation</Badge>
        </span>
        <span className="block">
          It cannot be selected for a run until it passes. Fix the source and save again.
        </span>
        {/* The engine's own words. A NameError here usually means the class
            subclasses BasePortfolio without importing it — the check cannot
            see that, so this is the first place it is reported. */}
        <code className="mt-1 block overflow-x-auto rounded bg-background px-2 py-1 font-mono text-xs">
          The validation run did not pass. Open the run for its recorded details.
        </code>
        <Link
          to={paths.backtestDetail(result.validationRunId)}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Open the validation run →
        </Link>
      </Panel>
    );
  }

  if (status === 'active') {
    return (
      <Panel tone="profit" icon={<CircleCheck className="size-4" aria-hidden />}>
        <strong>“{result.name}” passed validation and is active.</strong> It can be selected in the
        run dialog now.
      </Panel>
    );
  }

  // Anything else — `archived`, a state this client does not know, or no
  // state at all — is not a pass. Saying so beats guessing either way.
  return (
    <Panel tone="muted" icon={<CircleX className="size-4" aria-hidden />}>
      <span>
        <strong>
          “{result.name}” is in an unexpected state{status ? ` (${status})` : ''}.
        </strong>{' '}
        It has not been activated. Open the run for what the engine recorded.
      </span>
      <Link
        to={paths.backtestDetail(result.validationRunId)}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Open the validation run →
      </Link>
    </Panel>
  );
}

const TONES = {
  profit: 'border-[var(--profit)]/40 text-[var(--profit)]',
  loss: 'border-[var(--loss)]/40 text-[var(--loss)]',
  warn: 'border-[var(--loss)]/40 text-[var(--loss)]',
  muted: 'border-border text-muted-foreground',
} as const;

function Panel({
  tone,
  icon,
  alert = false,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      // `alert` is assertive on purpose for a failure: the author has moved on
      // to reading their own code by the time the run finishes.
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? 'assertive' : 'polite'}
      className={`flex gap-2 rounded-md border p-3 text-sm ${TONES[tone]}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  );
}
