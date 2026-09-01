import { Loader2, Play } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { useStrategies } from '@/features/strategies';

import { useCoverage, useSubmitBacktest } from './backtests-api';
import { backtestRunRequestSchema } from './types';

/**
 * Launches a backtest.
 *
 * `POST /backtests` has been built and working for some time with nothing
 * calling it, which meant the app could show runs and never start one.
 *
 * The dates are the part worth care. Market data ends weeks behind the
 * calendar, so a picker bounded by today offers windows with no prices in them,
 * and the run fails for a reason the author did not cause. The bounds and the
 * defaults both come from `GET /market-data/coverage` for the chosen strategy's
 * own universe.
 */

const DEFAULT_CAPITAL = 100_000;

/** How much history to preselect, when coverage allows that much. */
const DEFAULT_WINDOW_DAYS = 365;

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** `end` minus a year, floored at the earliest date the universe covers. */
function defaultStart(start: string, end: string): string {
  const earliest = new Date(`${start}T00:00:00Z`);
  const latest = new Date(`${end}T00:00:00Z`);
  const wanted = new Date(latest);
  wanted.setUTCDate(wanted.getUTCDate() - DEFAULT_WINDOW_DAYS);
  return isoDay(wanted > earliest ? wanted : earliest);
}

export function RunBacktestForm() {
  const strategies = useStrategies();
  const submit = useSubmitBacktest();

  const [strategyKey, setStrategyKey] = useState('');
  const [name, setName] = useState('');
  const [capital, setCapital] = useState(String(DEFAULT_CAPITAL));
  const [error, setError] = useState<string | null>(null);

  /*
   * The dates are derived from coverage unless the author has moved them.
   * Storing only the override, rather than syncing state from coverage in an
   * effect, is what keeps the window correct when the strategy changes: the
   * default follows the new universe instead of a stale value left in state.
   */
  const [startOverride, setStartOverride] = useState<string | null>(null);
  const [endOverride, setEndOverride] = useState<string | null>(null);

  const coverage = useCoverage(strategyKey || undefined);

  const strategyId = useId();
  const nameId = useId();
  const startId = useId();
  const endId = useId();
  const capitalId = useId();

  // Only strategies that have passed validation can be run; a draft has not
  // been proven to work and the backend would refuse it anyway.
  const runnable = useMemo(
    () => (strategies.data ?? []).filter((strategy) => strategy.status === 'active'),
    [strategies.data],
  );

  const covered = coverage.data;
  const hasWindow = Boolean(covered?.start && covered.end);

  const endDate = endOverride ?? covered?.end ?? '';
  const startDate =
    startOverride ??
    (covered?.start && covered.end ? defaultStart(covered.start, covered.end) : '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    submit.reset();

    const chosen = runnable.find((strategy) => strategy.id === strategyKey);
    const parsed = backtestRunRequestSchema.safeParse({
      name: name.trim() || `${chosen?.name ?? 'Run'} ${startDate} to ${endDate}`,
      strategyKey,
      startDate,
      endDate,
      initialCapital: Number(capital),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }

    if (parsed.data.startDate >= parsed.data.endDate) {
      setError('The start date has to come before the end date.');
      return;
    }

    // The date inputs carry min/max, but those only constrain the picker, and
    // nothing stops a typed date. Checking here means an out-of-coverage window
    // is refused with a reason instead of becoming a run with no bars in it.
    if (covered?.start && covered.end) {
      if (parsed.data.startDate < covered.start || parsed.data.endDate > covered.end) {
        setError(`There is only data from ${covered.start} to ${covered.end}.`);
        return;
      }
    }

    submit.mutate(parsed.data);
  }

  return (
    /*
     * `noValidate` so the browser's own constraint checking never silently
     * blocks a submit. It did: `step={1000}` with `min={1}` put the default
     * 100000 off the step grid, the form failed `checkValidity()`, and the
     * button appeared to do nothing at all. Validation belongs in one place,
     * and that place is the schema below, whose failures are rendered where a
     * person can see them.
     */
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={strategyId} className="text-sm font-medium">
            Strategy
          </label>
          <select
            id={strategyId}
            value={strategyKey}
            onChange={(event) => {
              setStrategyKey(event.target.value);
              // The old dates were bounded by the old universe's coverage.
              setStartOverride(null);
              setEndOverride(null);
              setError(null);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Pick a strategy</option>
            {runnable.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Run name <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Named from the strategy and window if left blank"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor={startId} className="text-sm font-medium">
            Start
          </label>
          <input
            id={startId}
            type="date"
            value={startDate}
            min={covered?.start ?? undefined}
            max={covered?.end ?? undefined}
            onChange={(event) => {
              setStartOverride(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={endId} className="text-sm font-medium">
            End
          </label>
          <input
            id={endId}
            type="date"
            value={endDate}
            min={covered?.start ?? undefined}
            max={covered?.end ?? undefined}
            onChange={(event) => {
              setEndOverride(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={capitalId} className="text-sm font-medium">
            Starting capital
          </label>
          <input
            id={capitalId}
            type="number"
            min={0}
            step={1000}
            value={capital}
            onChange={(event) => {
              setCapital(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <CoverageNote
        strategyChosen={Boolean(strategyKey)}
        isPending={coverage.isPending && Boolean(strategyKey)}
        isError={coverage.isError}
        start={covered?.start ?? null}
        end={covered?.end ?? null}
        missing={covered?.missing ?? []}
      />

      {error ? (
        <p role="alert" className="text-sm text-[var(--loss)]">
          {error}
        </p>
      ) : null}

      {submit.isError ? (
        <p role="alert" className="text-sm text-[var(--loss)]">
          {submit.error.message}
        </p>
      ) : null}

      {submit.isSuccess ? (
        <p role="status" className="text-sm text-[var(--profit)]">
          Queued.{' '}
          <Link to={`/backtests/${submit.data.id}`} className="underline underline-offset-4">
            Follow {submit.data.name}
          </Link>{' '}
          to watch it run.
        </p>
      ) : null}

      <Button type="submit" disabled={submit.isPending || !strategyKey || !hasWindow}>
        {submit.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Play className="mr-2 size-4" aria-hidden />
        )}
        Run backtest
      </Button>
    </form>
  );
}

/**
 * Says what the date bounds are and why, or why there are none.
 *
 * Without this the picker silently refuses dates outside coverage, which reads
 * as a broken control rather than as a fact about the data.
 */
function CoverageNote({
  strategyChosen,
  isPending,
  isError,
  start,
  end,
  missing,
}: {
  strategyChosen: boolean;
  isPending: boolean;
  isError: boolean;
  start: string | null;
  end: string | null;
  missing: string[];
}) {
  if (!strategyChosen) {
    return <p className="text-xs text-muted-foreground">Pick a strategy to see its date range.</p>;
  }
  if (isPending) {
    return <p className="text-xs text-muted-foreground">Checking how far the data goes…</p>;
  }
  if (isError) {
    return (
      <p className="text-xs text-[var(--loss)]">
        Could not read the data coverage, so the dates are unbounded. A window outside coverage
        will produce a run with no bars in it.
      </p>
    );
  }
  if (missing.length > 0) {
    return (
      <p className="text-xs text-[var(--loss)]">
        No market data at all for {missing.join(', ')}. This strategy cannot be backtested until
        that ticker is loaded.
      </p>
    );
  }
  if (!start || !end) {
    return <p className="text-xs text-muted-foreground">No coverage reported for this universe.</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      Data runs {start} to {end}. Dates outside that have no prices.
    </p>
  );
}
