import { z } from 'zod';

/**
 * Uploads this browser is still waiting on, remembered across reloads.
 *
 * A validation backtest takes as long as a backtest takes, and the author does
 * not owe the page their attention while it runs. Nothing on the server ties a
 * finished validation back to the person who started it — there is no
 * notification endpoint and, until auth lands, no reliable "my uploads" query
 * either. So the browser keeps the list: the strategy key, the run to watch,
 * and the last thing known about it.
 *
 * `localStorage`, not `sessionStorage`: the point is to survive closing the
 * window, which is the case that loses a failure silently today. It is
 * per-browser and that is honest — the record is "an upload *you* started
 * here", not a server-side fact.
 */

const STORAGE_KEY = 'mqs.strategy-submissions';

/** Anything older than this is not worth re-checking on a cold start. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const submissionSchema = z.object({
  /** The strategy key, which is also what `GET /strategies/{key}` takes. */
  strategyKey: z.string().min(1),
  name: z.string().default(''),
  /** The validation backtest to watch. Null when none was started. */
  validationRunId: z.string().nullable().default(null),
  submittedAt: z.string(),
  /**
   * What this browser last saw. `pending` until the run reaches a terminal
   * state, so a reload knows whether to resume polling or just report.
   */
  outcome: z.enum(['pending', 'passed', 'failed']).default('pending'),
  /** The engine's own words, kept so a reload can still show them. */
  errorMessage: z.string().nullable().default(null),
  /** Cleared from the banner by the author, but kept for the drafts list. */
  acknowledged: z.boolean().default(false),
});
export type SubmissionRecord = z.infer<typeof submissionSchema>;

const storedSchema = z.array(submissionSchema).catch([]);

export function readSubmissions(): SubmissionRecord[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // A private window, blocked site data, or a thumbnail capture all throw
    // here. Forgetting an upload is better than failing to render.
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  return storedSchema
    .parse(parsed)
    .filter((entry) => Date.parse(entry.submittedAt) > cutoff)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

function write(entries: SubmissionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Same as reading: not worth breaking a save over.
  }
}

/** Records a new upload, replacing any earlier entry for the same key. */
export function rememberSubmission(
  entry: Omit<SubmissionRecord, 'outcome' | 'errorMessage' | 'acknowledged'>,
): SubmissionRecord[] {
  const next = [
    { ...entry, outcome: 'pending' as const, errorMessage: null, acknowledged: false },
    ...readSubmissions().filter((existing) => existing.strategyKey !== entry.strategyKey),
  ];
  write(next);
  return next;
}

/** Records what a validation run turned out to be. */
export function resolveSubmission(
  strategyKey: string,
  outcome: 'passed' | 'failed',
  errorMessage: string | null = null,
): SubmissionRecord[] {
  const next = readSubmissions().map((entry) =>
    entry.strategyKey === strategyKey ? { ...entry, outcome, errorMessage } : entry,
  );
  write(next);
  return next;
}

/** Dismisses the banner for one upload without forgetting the draft. */
export function acknowledgeSubmission(strategyKey: string): SubmissionRecord[] {
  const next = readSubmissions().map((entry) =>
    entry.strategyKey === strategyKey ? { ...entry, acknowledged: true } : entry,
  );
  write(next);
  return next;
}

export function forgetSubmission(strategyKey: string): SubmissionRecord[] {
  const next = readSubmissions().filter((entry) => entry.strategyKey !== strategyKey);
  write(next);
  return next;
}

/** Where the list is kept, so a test or another tab can watch the same key. */
export const SUBMISSIONS_STORAGE_KEY = STORAGE_KEY;
