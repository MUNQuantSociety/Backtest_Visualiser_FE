import { Loader2, Play, X } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useStrategies } from '@/features/strategies';
import { useEngineIndicators } from '@/features/strategies';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/format';


import { useCoverage, useSubmitBacktest } from './backtests-api';
import {
  coverageSegments,
  coverageYearTicks,
  isoDay,
  latestFirstBar,
  matchingPreset,
  presetWindow,
  sessionsIn,
  tickerCoverageState,
  WINDOW_PRESETS,
  type CoverageDot,
  type WindowPreset,
} from './run-window';
import { backtestRunRequestSchema } from './types';

const log = createLogger('backtest-form');

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
 *
 * Universe, costs, signals and the sentiment gate travel inside `params`: the
 * backend separates these reserved execution controls from strategy specs.
 * Signal overrides and sentiment gating are not implemented and stay disabled.
 */

const DEFAULT_CAPITAL = 100_000;
const DEFAULT_SLIPPAGE_BPS = 5;
const DEFAULT_COMMISSION = 0.005;
const DEFAULT_SENTIMENT_THRESHOLD = -0.25;

/** How much history to preselect, when coverage allows that much. */
const DEFAULT_WINDOW_DAYS = 365;

/**
 * Fallback signal list, used only when the engine's own cannot be fetched.
 *
 * This used to be the whole list, hardcoded — and it was wrong: it offered
 * MACD and Bollinger, which the engine does not ship, so a member could pick a
 * signal that could never have been applied. `GET /strategies/indicators` is
 * the real source; these are the two names most likely to be recognised if it
 * is unreachable.
 */
const FALLBACK_SIGNALS = ['SimpleMovingAverage', 'RelativeStrengthIndex'] as const;

const MODES = [
  { value: 'event', label: 'Event' },
  { value: 'fast', label: 'Fast' },
] as const;

type Mode = (typeof MODES)[number]['value'];

/** `end` minus a year, floored at the earliest date the universe covers. */
function defaultStart(start: string, end: string): string {
  const earliest = new Date(`${start}T00:00:00Z`);
  const latest = new Date(`${end}T00:00:00Z`);
  const wanted = new Date(latest);
  wanted.setUTCDate(wanted.getUTCDate() - DEFAULT_WINDOW_DAYS);
  return isoDay(wanted > earliest ? wanted : earliest);
}

interface RunBacktestFormProps {
  /** `dialog` puts the summary and buttons in a footer bar; `card` inlines them. */
  layout?: 'card' | 'dialog' | undefined;
  /** Start with this strategy chosen — "re-run" from a strategy's own page. */
  initialStrategyKey?: string | undefined;
  /** Dismiss the containing dialog before opening the accepted run. */
  onSubmitted?: (() => void) | undefined;
}

export function RunBacktestForm({
  layout = 'card',
  initialStrategyKey,
  onSubmitted,
}: RunBacktestFormProps) {
  const strategies = useStrategies();
  const submit = useSubmitBacktest();
  const navigate = useNavigate();

  const [strategyKey, setStrategyKey] = useState(initialStrategyKey ?? '');
  const [name, setName] = useState('');
  const [capital, setCapital] = useState(String(DEFAULT_CAPITAL));
  const [slippageBps, setSlippageBps] = useState(String(DEFAULT_SLIPPAGE_BPS));
  const [commission, setCommission] = useState(String(DEFAULT_COMMISSION));
  const [mode, setMode] = useState<Mode>('event');
  const [gateEnabled, setGateEnabled] = useState(false);
  const [gateThreshold, setGateThreshold] = useState(DEFAULT_SENTIMENT_THRESHOLD);
  const [paramValues, setParamValues] = useState<Record<string, string | boolean>>({});
  const [tickerDraft, setTickerDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  /*
   * The dates and the universe are derived from the strategy and its coverage
   * unless the author has moved them. Storing only the override, rather than
   * syncing state from coverage in an effect, is what keeps them correct when
   * the strategy changes: the default follows the new universe instead of a
   * stale value left in state.
   */
  const [startOverride, setStartOverride] = useState<string | null>(null);
  const [endOverride, setEndOverride] = useState<string | null>(null);
  const [universeOverride, setUniverseOverride] = useState<readonly string[] | null>(null);

  const coverage = useCoverage(strategyKey || undefined, universeOverride ?? undefined);
  // The engine's indicator classes, so this list offers what could actually be
  // applied rather than names invented in the client.
  const engineIndicators = useEngineIndicators();
  const signalNames: readonly string[] = engineIndicators.data ?? FALLBACK_SIGNALS;

  const nameId = useId();
  const startId = useId();
  const endId = useId();
  const capitalId = useId();
  const slippageId = useId();
  const commissionId = useId();
  const tickerId = useId();
  const gateId = useId();

  // Only strategies that have passed validation can be run; a draft has not
  // been proven to work and the backend would refuse it anyway.
  const runnable = useMemo(
    () => (strategies.data ?? []).filter((strategy) => strategy.status === 'active'),
    [strategies.data],
  );
  const chosen = runnable.find((strategy) => strategy.id === strategyKey);
  // What the chosen strategy declares, for the highlight. Empty until one is
  // picked, and empty for an uploaded file whose source the list does not read.
  const strategyIndicators: readonly string[] = chosen?.indicators ?? [];


  const covered = coverage.data;
  const hasWindow = Boolean(covered?.start && covered.end);

  const endDate = endOverride ?? covered?.end ?? '';
  const startDate =
    startOverride ??
    (covered?.start && covered.end ? defaultStart(covered.start, covered.end) : '');
  const window = startDate && endDate ? { startDate, endDate } : null;
  const universe = universeOverride ?? chosen?.universe ?? [];

  const activePreset =
    window && covered?.start && covered.end
      ? matchingPreset(window, { start: covered.start, end: covered.end })
      : null;
  const clampedTo = latestFirstBar(covered);

  function chooseStrategy(id: string) {
    log.info('strategy selected; resetting universe and dates', {
      previousStrategyKey: strategyKey,
      strategyKey: id,
    });
    setStrategyKey(id);
    // The old dates and tickers belonged to the old universe.
    setStartOverride(null);
    setEndOverride(null);
    setUniverseOverride(null);
    setParamValues({});
    setError(null);
  }

  function applyPreset(preset: WindowPreset) {
    if (!covered?.start || !covered.end) return;
    const next = presetWindow(preset, { start: covered.start, end: covered.end });
    log.info('date preset selected', { strategyKey, preset, ...next });
    setStartOverride(next.startDate);
    setEndOverride(next.endDate);
  }

  function addTicker() {
    const ticker = tickerDraft.trim().toUpperCase();
    if (!ticker) return;
    if (!universe.includes(ticker)) {
      log.info('ticker added; checking updated universe', {
        strategyKey,
        ticker,
        tickers: [...universe, ticker],
      });
      setUniverseOverride([...universe, ticker]);
    }
    setTickerDraft('');
  }

  function removeTicker(ticker: string) {
    log.info('ticker removed; checking updated universe', {
      strategyKey,
      ticker,
      tickers: universe.filter((existing) => existing !== ticker),
    });
    setUniverseOverride(universe.filter((existing) => existing !== ticker));
  }

  /**
   * Everything the request schema has no field for, keyed for the backend.
   * Execution keys are reserved by the backend; strategy parameters are
   * validated against the selected strategy's published specification.
   */
  function buildParams(): Record<string, unknown> {
    const strategyParams: Record<string, number | boolean> = {};
    for (const spec of chosen?.parameters ?? []) {
      const raw = paramValues[spec.key];
      if (spec.type === 'boolean') {
        strategyParams[spec.key] = typeof raw === 'boolean' ? raw : spec.default === true;
        continue;
      }
      const typed = typeof raw === 'string' ? Number(raw) : Number(spec.default);
      strategyParams[spec.key] =
        spec.type === 'percent' && typeof raw === 'string' ? typed / 100 : typed;
    }
    return {
      universe,
      slippageBps: Number(slippageBps),
      commissionPerShare: Number(commission),
      // Always empty, and sent anyway so the key is present and explicit.
      // `run_controls.py` refuses a non-empty list: the engine builds
      // indicators from the strategy class, and one injected per run would be
      // registered and never read by its OnData. The Signals row shows which
      // the strategy declares rather than pretending they are selectable.
      signals: [] as readonly string[],
      sentimentGate: { enabled: gateEnabled, threshold: gateThreshold },
      ...strategyParams,
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submit.isPending) return;
    log.info('run requested; validating form', {
      strategyKey,
      tickers: universe,
      startDate,
      endDate,
      mode,
      coverageStatus: coverage.status,
    });
    setError(null);
    submit.reset();

    const parsed = backtestRunRequestSchema.safeParse({
      name: name.trim() || `${chosen?.name ?? 'Run'} ${startDate} to ${endDate}`,
      strategyKey,
      startDate,
      endDate,
      initialCapital: Number(capital),
      mode,
      params: buildParams(),
    });

    if (!parsed.success) {
      log.warn('run blocked by form validation', { strategyKey, issues: parsed.error.issues });
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }

    if (parsed.data.startDate >= parsed.data.endDate) {
      log.warn('run blocked: start date must precede end date', {
        strategyKey,
        startDate,
        endDate,
      });
      setError('The start date has to come before the end date.');
      return;
    }

    // The date inputs carry min/max, but those only constrain the picker, and
    // nothing stops a typed date. Checking here means an out-of-coverage window
    // is refused with a reason instead of becoming a run with no bars in it.
    if (covered?.start && covered.end) {
      if (parsed.data.startDate < covered.start || parsed.data.endDate > covered.end) {
        log.warn('run blocked: dates outside market-data coverage', {
          strategyKey,
          startDate,
          endDate,
          coverageStart: covered.start,
          coverageEnd: covered.end,
        });
        setError(`There is only data from ${covered.start} to ${covered.end}.`);
        return;
      }
    }

    log.info('form validation passed; submitting run', { strategyKey, tickers: universe });
    submit.mutate(parsed.data, {
      onSuccess: (run) => {
        log.info('run accepted; opening progress page', { runId: run.id });
        onSubmitted?.();
        void navigate(paths.backtestDetail(run.id));
        // The dashboard/library may have been scrolled behind the modal.
        globalThis.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      },
    });
  }

  const sessions = window ? sessionsIn(window.startDate, window.endDate) : 0;
  const bars = sessions * universe.length;
  const estimateSeconds = Math.max(1, Math.round(bars / 400));
  const fieldClass =
    'tabular h-[34px] w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    /*
     * `noValidate` so the browser's own constraint checking never silently
     * blocks a submit. It did: `step={1000}` with `min={1}` put the default
     * 100000 off the step grid, the form failed `checkValidity()`, and the
     * button appeared to do nothing at all. Validation belongs in one place,
     * and that place is the schema above, whose failures are rendered where a
     * person can see them.
     */
    <form onSubmit={handleSubmit} noValidate>
      <div className={cn('space-y-[22px]', layout === 'dialog' ? 'px-6 py-5' : '')}>
        <Row label="Strategy">
          <div role="radiogroup" aria-label="Strategy" className="grid gap-2 sm:grid-cols-2">
            {runnable.map((strategy) => {
              const active = strategy.id === strategyKey;
              return (
                <label
                  key={strategy.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                    // The chosen card takes the full row, per the spec: it is the one
                    // whose name and universe must not be cut short.
                    active
                      ? 'border-primary bg-selected sm:col-span-2'
                      : 'border-border hover:bg-muted/60',
                  )}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={strategy.id}
                    checked={active}
                    onChange={() => {
                      chooseStrategy(strategy.id);
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-primary' : 'border-[var(--border-strong)]',
                    )}
                  >
                    {active ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-[13px] font-medium',
                        active && 'text-selected-foreground',
                      )}
                    >
                      {strategy.name}
                    </span>
                    <span className="tabular block truncate text-[11px] text-muted-foreground">
                      {strategy.universe.join(', ')}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                    best Sharpe{' '}
                    {strategy.bestSharpe === null ? '—' : formatNumber(strategy.bestSharpe)}
                  </span>
                </label>
              );
            })}
            {strategies.isPending ? (
              <p className="text-xs text-muted-foreground">Loading strategies…</p>
            ) : null}
            {!strategies.isPending && runnable.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active strategies to run.</p>
            ) : null}
          </div>
        </Row>

        <Row label="Universe">
          <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
            {universe.map((ticker) => (
              <span
                key={ticker}
                className="tabular inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 text-xs"
              >
                <CoverageDotMark state={tickerCoverageState(ticker, covered, window)} />
                {ticker}
                <button
                  type="button"
                  aria-label={`Remove ${ticker}`}
                  onClick={() => {
                    removeTicker(ticker);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
            <input
              id={tickerId}
              aria-label="Add ticker"
              value={tickerDraft}
              onChange={(event) => {
                setTickerDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTicker();
                }
              }}
              onBlur={addTicker}
              placeholder="Add ticker…"
              disabled={!strategyKey}
              className="tabular min-w-24 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
          {clampedTo && covered?.start ? (
            <p className="mt-1.5 text-[11px] text-[var(--warning)]">
              {clampedTo.ticker} has bars from {clampedTo.firstBar.slice(0, 7)} — the window below
              is clamped to it.
            </p>
          ) : null}
        </Row>

        <Row label="Window">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <label htmlFor={startId} className="text-[13px] font-medium">
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
                className={fieldClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={endId} className="text-[13px] font-medium">
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
                className={fieldClass}
              />
            </div>
            <div className="flex items-end">
              <Segmented
                value={activePreset ?? ('' as WindowPreset)}
                options={WINDOW_PRESETS}
                onChange={applyPreset}
                ariaLabel="Window preset"
              />
            </div>
          </div>

          {covered?.start && covered.end ? (
            <CoverageBar
              segments={coverageSegments(covered, window)}
              ticks={coverageYearTicks({ start: covered.start, end: covered.end })}
            />
          ) : null}

          <CoverageNote
            strategyChosen={Boolean(strategyKey)}
            isPending={coverage.isPending && Boolean(strategyKey)}
            isError={coverage.isError}
            start={covered?.start ?? null}
            end={covered?.end ?? null}
            missing={covered?.missing ?? []}
          />
        </Row>

        <Row label="Capital & costs">
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <UnitField id={capitalId} label="Initial capital" unit="USD">
              <input
                id={capitalId}
                type="number"
                min={0}
                step={1000}
                value={capital}
                onChange={(event) => {
                  setCapital(event.target.value);
                }}
                className={cn(fieldClass, 'pr-12')}
              />
            </UnitField>
            <UnitField id={slippageId} label="Slippage" unit="bps">
              <input
                id={slippageId}
                type="number"
                min={0}
                step={1}
                value={slippageBps}
                onChange={(event) => {
                  setSlippageBps(event.target.value);
                }}
                className={cn(fieldClass, 'pr-12')}
              />
            </UnitField>
            <UnitField id={commissionId} label="Commission" unit="$/sh">
              <input
                id={commissionId}
                type="number"
                min={0}
                step={0.001}
                value={commission}
                onChange={(event) => {
                  setCommission(event.target.value);
                }}
                className={cn(fieldClass, 'pr-12')}
              />
            </UnitField>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium">Mode</span>
              <Segmented value={mode} options={MODES} onChange={setMode} ariaLabel="Run mode" />
            </div>
          </div>
        </Row>

        <Row label="Signals">
          <p className="mb-1.5 text-xs text-muted-foreground">
            Read-only. A strategy registers its own indicators in its{' '}
            <code className="tabular">INDICATORS</code> block, so a run cannot add or remove
            them. Highlighted ones are what this strategy uses.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {signalNames.map((signal) => {
              // "Active" means the chosen strategy declares it, not that
              // anyone selected it. Nothing here is selectable: the engine
              // builds indicators from the class, and a run-time override
              // would be registered and never read. Showing which are live is
              // the honest thing this list can do.
              const used = strategyIndicators.includes(signal);
              return (
                <span
                  key={signal}
                  className={cn(
                    'tabular rounded border px-2 py-1 text-xs',
                    used
                      ? 'border-primary bg-selected text-selected-foreground'
                      : 'border-border text-muted-foreground/60',
                  )}
                >
                  {signal}
                </span>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md bg-background px-3 py-2 text-[13px]">
            <label htmlFor={gateId} className="flex cursor-pointer items-center gap-2">
              <input
                id={gateId}
                type="checkbox"
                role="switch"
                disabled
                aria-checked={gateEnabled}
                checked={gateEnabled}
                onChange={(event) => {
                  setGateEnabled(event.target.checked);
                }}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'relative h-4 w-7 rounded-full transition-colors',
                  gateEnabled ? 'bg-primary' : 'bg-[var(--border-strong)]',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-3 rounded-full bg-background transition-transform',
                    gateEnabled ? 'translate-x-3.5' : 'translate-x-0.5',
                  )}
                />
              </span>
              <span className="font-medium">Sentiment gate</span>
            </label>
            <span className="text-muted-foreground">
              — skip long entries when the 7d article score is below
            </span>
            <input
              type="range"
              aria-label="Sentiment gate threshold"
              min={-1}
              max={0}
              step={0.05}
              value={gateThreshold}
              disabled={!gateEnabled}
              onChange={(event) => {
                setGateThreshold(Number(event.target.value));
              }}
              className="h-1.5 w-[120px] accent-primary disabled:opacity-40"
            />
            <span className="tabular w-12 text-right">{gateThreshold.toFixed(2)}</span>
          </div>
        </Row>

        {chosen && chosen.parameters.length > 0 ? (
          <Row label="Parameters">
            <div className="grid gap-3 sm:grid-cols-3">
              {chosen.parameters.map((spec) => {
                const raw = paramValues[spec.key];
                if (spec.type === 'boolean') {
                  const value = typeof raw === 'boolean' ? raw : spec.default === true;
                  const changed = value !== (spec.default === true);
                  return (
                    <label
                      key={spec.key}
                      className="flex items-center gap-2 text-[13px]"
                      title={changed ? 'Changed from default' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(event) => {
                          setParamValues((current) => ({
                            ...current,
                            [spec.key]: event.target.checked,
                          }));
                        }}
                      />
                      {spec.label}
                      {changed ? <ChangedMark /> : null}
                    </label>
                  );
                }
                const shown =
                  typeof raw === 'string'
                    ? raw
                    : String(spec.type === 'percent' ? Number(spec.default) * 100 : spec.default);
                const changed =
                  typeof raw === 'string' &&
                  Number(raw) !==
                    (spec.type === 'percent' ? Number(spec.default) * 100 : Number(spec.default));
                return (
                  <UnitField
                    key={spec.key}
                    id={`${nameId}-${spec.key}`}
                    label={
                      <>
                        {spec.label}
                        {changed ? <ChangedMark /> : null}
                      </>
                    }
                    unit={spec.type === 'percent' ? '%' : null}
                  >
                    <input
                      id={`${nameId}-${spec.key}`}
                      type="number"
                      step={spec.type === 'integer' ? 1 : 'any'}
                      min={
                        spec.min === undefined
                          ? undefined
                          : spec.type === 'percent'
                            ? spec.min * 100
                            : spec.min
                      }
                      max={
                        spec.max === undefined
                          ? undefined
                          : spec.type === 'percent'
                            ? spec.max * 100
                            : spec.max
                      }
                      value={shown}
                      onChange={(event) => {
                        setParamValues((current) => ({
                          ...current,
                          [spec.key]: event.target.value,
                        }));
                      }}
                      className={cn(fieldClass, spec.type === 'percent' && 'pr-8')}
                    />
                  </UnitField>
                );
              })}
            </div>
          </Row>
        ) : null}

        <Row label="Run name">
          <input
            id={nameId}
            aria-label="Run name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder={chosen && window ? `${chosen.name} ${startDate} to ${endDate}` : ''}
            className={cn(fieldClass, 'font-sans')}
          />
        </Row>

        {error ? (
          <p role="alert" className="text-[13px] text-[var(--loss)]">
            {error}
          </p>
        ) : null}

        {submit.isError ? (
          <p role="alert" className="text-[13px] text-[var(--loss)]">
            {submit.error.message}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          layout === 'dialog'
            ? 'sticky bottom-0 border-t bg-background px-6 py-3.5'
            : 'mt-5 border-t pt-4',
        )}
      >
        <span className="tabular text-xs text-muted-foreground">
          {window
            ? `${formatNumber(sessions, 0)} sessions · ${String(universe.length)} tickers · ${formatNumber(bars, 0)} bars · est. ${String(estimateSeconds)}s`
            : 'Pick a strategy and a window.'}
        </span>
        <div className="flex items-center gap-2">
          {/* No preset endpoint exists yet; a disabled control says so rather
              than a working-looking one that silently drops the click. */}
          <Button type="button" variant="outline" size="sm" disabled title="Not wired up yet">
            Save as preset
          </Button>
          <Button type="submit" size="sm" disabled={submit.isPending || !strategyKey || !hasWindow}>
            {submit.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="mr-2 size-4" aria-hidden />
            )}
            {submit.isPending ? 'Starting backtest…' : 'Run backtest'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** One `150px | 1fr` row: section label on the left, controls on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[150px_1fr] sm:gap-4">
      <p className="text-[13px] font-medium">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function UnitField({
  id,
  label,
  unit,
  children,
}: {
  id: string;
  label: ReactNode;
  unit: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-1 text-[13px] font-medium">
        {label}
      </label>
      <div className="relative">
        {children}
        {unit ? (
          <span className="tabular pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChangedMark() {
  return (
    <span
      className="ml-1 inline-block size-1.5 rounded-full bg-[var(--selected-foreground)]"
      title="Changed from default"
      aria-label="changed from default"
    />
  );
}

const DOT_COLOUR: Record<CoverageDot, string> = {
  full: 'var(--profit)',
  partial: 'var(--warning)',
  missing: 'var(--loss)',
  unknown: 'var(--neutral)',
};

const DOT_TITLE: Record<CoverageDot, string> = {
  full: 'Data covers the whole window',
  partial: 'Data covers only part of the window',
  missing: 'No market data',
  unknown: 'Coverage unknown for this ticker',
};

function CoverageDotMark({ state }: { state: CoverageDot }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full"
      style={{ background: DOT_COLOUR[state] }}
      title={DOT_TITLE[state]}
      role="img"
      aria-label={DOT_TITLE[state]}
    />
  );
}

/**
 * The full coverage span as a track, the chosen window over it, and any
 * stretch where a ticker has no bars hatched — so a clamped window is
 * visibly explained rather than silently refused by the date picker.
 */
function CoverageBar({
  segments,
  ticks,
}: {
  segments: ReturnType<typeof coverageSegments>;
  ticks: ReturnType<typeof coverageYearTicks>;
}) {
  return (
    <div className="mt-3">
      <div className="relative h-2.5 overflow-hidden rounded-sm bg-muted" aria-hidden>
        {segments
          .filter((segment) => segment.kind === 'gap')
          .map((segment, index) => (
            <span
              key={`gap-${String(index)}`}
              className="absolute inset-y-0"
              style={{
                left: `${String(segment.from * 100)}%`,
                width: `${String((segment.to - segment.from) * 100)}%`,
                backgroundImage:
                  'repeating-linear-gradient(135deg, var(--border-strong) 0 2px, transparent 2px 5px)',
              }}
              title={segment.ticker ? `No data for ${segment.ticker}` : undefined}
            />
          ))}
        {segments
          .filter((segment) => segment.kind === 'selected')
          .map((segment, index) => (
            <span
              key={`sel-${String(index)}`}
              className="absolute inset-y-0 bg-primary/85"
              style={{
                left: `${String(segment.from * 100)}%`,
                width: `${String((segment.to - segment.from) * 100)}%`,
              }}
            />
          ))}
      </div>
      {/* Endpoints describe the scale without colliding with nearby January
          labels. Normal flow also reserves height if a narrow dialog wraps. */}
      <div
        data-slot="coverage-axis"
        className="tabular mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[10px] text-muted-foreground"
      >
        {ticks
          .filter((_, index) => index === 0 || index === ticks.length - 1)
          .map((tick, index) => (
            <span key={`${tick.label}-${String(index)}`} className="whitespace-nowrap">
              {tick.label}
            </span>
          ))}
      </div>
    </div>
  );
}

/**
 * Show loading and unavailable-coverage states; the date inputs and scale
 * already show the bounds when coverage is available.
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
    return (
      <p className="mt-2 text-xs text-muted-foreground">Pick a strategy to see its date range.</p>
    );
  }
  if (isPending) {
    return <p className="mt-2 text-xs text-muted-foreground">Checking how far the data goes…</p>;
  }
  if (isError) {
    return (
      <p className="mt-2 text-xs text-[var(--loss)]">
        Could not check market-data coverage. Check the backend connection and retry. Running is
        disabled until coverage is available.
      </p>
    );
  }
  if (missing.length > 0) {
    return (
      <p className="mt-2 text-xs text-[var(--loss)]">
        No market data at all for {missing.join(', ')}. This strategy cannot be backtested until
        that ticker is loaded.
      </p>
    );
  }
  if (!start || !end) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">No coverage reported for this universe.</p>
    );
  }
  return null;
}
