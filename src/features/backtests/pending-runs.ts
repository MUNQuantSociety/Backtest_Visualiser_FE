import { z } from 'zod';

import { backtestSummarySchema, type BacktestSummary } from './types';

/**
 * Runs this browser started that have not been seen to finish.
 *
 * `GET /backtests` lists finished runs only: a queued or running one exists at
 * `GET /backtests/{id}` and nowhere else until it completes. So the run
 * history cannot poll itself into showing a new run — it never holds anything
 * in flight — and the detail page, which does poll, is gone the moment the
 * person navigates away. Someone has to keep watching: the browser that
 * submitted a run records it here, and runs started in another browser are
 * added when `GET /backtests/active` reports them.
 *
 * Each entry keeps the summary the backend accepted the run with, so the run
 * history can show a `queued` row before the first poll answers.
 *
 * `localStorage`, like the strategy submissions store, so a reload mid-run
 * resumes the watch instead of losing the row until the next reload.
 *
 * Entries do not expire by age. A backtest has no run-time limit, and the
 * backend already answers 404 for any run it has lost — jobs do not survive an
 * API restart — which ends the watch. An age cutoff could only drop a run that
 * is still going.
 */

const STORAGE_KEY = 'mqs.pending-runs';

/** Fired on `window` after every write, so same-tab subscribers hear about it. */
export const PENDING_RUNS_CHANGED_EVENT = 'mqs.pending-runs-changed';

export const pendingRunSchema = z.object({
  id: z.string().min(1),
  submittedAt: z.string(),
  summary: backtestSummarySchema,
});
export type PendingRun = z.infer<typeof pendingRunSchema>;

const storedSchema = z.array(pendingRunSchema).catch([]);

export function readPendingRuns(): PendingRun[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // A private window, blocked site data, or a thumbnail capture all throw
    // here. Forgetting a run is better than failing to render.
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  return storedSchema.parse(parsed);
}

function write(entries: PendingRun[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Same as reading: not worth breaking a submission over.
  }
  // `storage` fires only in other documents, so the tab that wrote never hears
  // about its own change. Deferred so a write made during render (a mutation's
  // callback, say) never updates another component mid-render.
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(PENDING_RUNS_CHANGED_EVENT));
  });
}

/** Records a run just accepted by the backend. */
export function rememberPendingRun(
  summary: BacktestSummary,
  submittedAt = new Date().toISOString(),
): PendingRun[] {
  const next = [
    { id: summary.id, submittedAt, summary },
    ...readPendingRuns().filter((entry) => entry.id !== summary.id),
  ];
  write(next);
  return next;
}

/** Drops a run that has reached a terminal state, or no longer exists. */
export function forgetPendingRun(id: string): PendingRun[] {
  const current = readPendingRuns();
  const next = current.filter((entry) => entry.id !== id);
  if (next.length !== current.length) write(next);
  return next;
}

/**
 * The run history as the person should see it: rows the server listed, plus a
 * row for each run started here that the server does not list yet.
 *
 * The server row wins on a shared id. A run that has just finished is still
 * pending here until the refetched list carries it, so both sides briefly hold
 * the same id — and the saved report is the one to show.
 *
 * @param server - Rows from `GET /backtests`, in the order the page wants.
 * @param pending - Rows for runs this browser is still following.
 * @returns Pending-only rows first (they are the newest), then the server rows.
 */
export function mergeRunRows(
  server: readonly BacktestSummary[],
  pending: readonly BacktestSummary[],
): BacktestSummary[] {
  if (pending.length === 0) return [...server];
  const listed = new Set(server.map((run) => run.id));
  return [...pending.filter((run) => !listed.has(run.id)), ...server];
}

/** Where the list is kept, so a test or another tab can watch the same key. */
export const PENDING_RUNS_STORAGE_KEY = STORAGE_KEY;
