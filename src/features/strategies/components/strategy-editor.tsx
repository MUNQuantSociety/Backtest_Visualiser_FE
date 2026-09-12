import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  FileCode,
  FileUp,
  Loader2,
  PencilLine,
} from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { env } from '@/config/env';
import { cn } from '@/lib/utils';

import {
  useCheckDraft,
  useEngineIndicators,
  useCheckStrategy,
  useStrategyTemplate,
  useSubmitDraft,
  useSubmitStrategy,
} from '../strategies-api';
import {
  MAX_SOURCE_BYTES,
  strategyCheckRequestSchema,
  strategyDraftSchema,
  strategySubmissionSchema,
  type CompatibilityIssue,
  type IndicatorSpec,
  type StrategyCheckResult,
  type StrategySubmissionResult,
} from '../types';
import { useSubmissions } from '../use-submissions';

import { IndicatorRows } from './indicator-rows';
import { ValidationOutcome } from './validation-outcome';

/** A saved strategy opened for editing: its identity, and its stored code. */
export interface EditingStrategy {
  key: string;
  name: string;
  description: string;
  source: string;
  /*
   * The fragment it was authored from, when it was. Null for an uploaded
   * file — there is no body to reopen, and `source` is what its author wrote.
   * Reopening a draft as its fragment is the whole reason the backend stores
   * this on the registry row.
   */
  body?: string | null;
  indicators?: IndicatorSpec[] | null;
  state?: Record<string, unknown> | null;
}

/**
 * Fallback starter code, reached only when the real one cannot be fetched.
 *
 * `GET /strategies/template` is the source of truth. It lives beside the check
 * that judges it, with a test asserting it passes. This copy exists so the
 * editor is never empty when the backend is unreachable, and it is deliberately
 * the same text: a fallback teaching a different contract is worse than none.
 *
 * Keeping a copy here is what went wrong before. The previous one was written
 * from memory against a base class that never existed, and nothing caught it
 * because nothing compared the two.
 */
const FALLBACK_TEMPLATE = `from engine.strategies.order_interface import StrategyContext
from engine.strategies.portfolio_BASE.strategy import BasePortfolio


class MyStrategy(BasePortfolio):
    """One sentence on what edge this is trying to capture."""

    # "attribute_name": ("IndicatorName", {parameters}). One instance per
    # ticker, so self.fast_sma[ticker] is the indicator for that ticker.
    # BasePortfolio builds and warms them before the first bar; self.tickers,
    # self.lookback_days and self.logger are ready by then too.
    INDICATORS = {
        "fast_sma": ("SimpleMovingAverage", {"period": 20}),
        "slow_sma": ("SimpleMovingAverage", {"period": 50}),
    }

    # Anything you want to remember between bars: "attribute_name": default.
    # Each default is copied per run, so self.last_price is your own dict.
    STATE = {"last_price": {}}

    def OnData(self, context: StrategyContext):
        """Called once per bar. Trade through \`context\`; return nothing."""
        for ticker in self.tickers:
            asset = context.Market[ticker]
            fast = self.fast_sma[ticker]
            slow = self.slow_sma[ticker]

            # Indicators need their full period before they mean anything.
            if not (asset.Exists and fast.IsReady and slow.IsReady):
                continue

            holding = context.Portfolio.positions.get(ticker, 0)

            if fast.Current > slow.Current and holding <= 0:
                context.buy(ticker, confidence=1.0)
            elif fast.Current < slow.Current and holding > 0:
                context.sell(ticker, confidence=1.0)

            # Whatever you put in STATE is yours to keep across bars.
            self.last_price[ticker] = asset.Close
`;

/**
 * Split a whole file into the part before the strategy class and the rest.
 *
 * The prelude is imports and nothing a member edits by hand, so the whole-file
 * editor hides it and shows the file from `class …` onward. Two things this
 * deliberately does *not* do:
 *
 * It does not substitute a canned prelude. An uploaded file may legitimately
 * import numpy or pandas, and re-attaching a fixed two-line header on submit
 * would silently delete them. Whatever preceded the class is preserved
 * verbatim and put back unchanged.
 *
 * It does not hide anything when there is no class line to split on — a file
 * mid-edit, or one that never had a class. Then the editor shows everything,
 * because a member cannot fix what they cannot see.
 */
function splitPrelude(source: string): { prelude: string; visible: string; lines: number } {
  const match = /^class\s+\w+\s*\(/m.exec(source);
  if (!match?.index) return { prelude: '', visible: source, lines: 0 };

  const prelude = source.slice(0, match.index);
  return {
    prelude,
    visible: source.slice(match.index),
    // How many lines were hidden, so reported line numbers can be shown
    // against what is on screen rather than against the file.
    lines: prelude.split('\n').length - 1,
  };
}

const ACCEPTED_EXTENSIONS = ['.py'];

/**
 * `fragment` is the OnData-only path: the member writes a method body and
 * declares indicators, and the backend generates the file around it. `write`
 * and `upload` stay on the full-file path — this adds a way to author, it does
 * not remove one.
 */
type Mode = 'fragment' | 'write' | 'upload';

/**
 * `editing` opens the editor on a saved strategy instead of the template.
 *
 * Saving still creates a *new* strategy: the registry has create and delete
 * and no update, so there is nothing to edit in place. The banner below says
 * as much, because a form that looks like it edits a row and silently forks it
 * is worse than one that admits what it does.
 */
export function StrategyEditor({ editing }: { editing?: EditingStrategy | undefined } = {}) {
  // Fragment mode is the default for a new strategy: it is the one where a
  // reported line number is a line the member actually wrote.
  const [mode, setMode] = useState<Mode>(editing ? 'write' : 'fragment');
  const [name, setName] = useState(editing ? `${editing.name} (edited)` : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmitStrategy();
  const check = useCheckStrategy();
  const template = useStrategyTemplate();
  const { remember } = useSubmissions();
  const engineIndicators = useEngineIndicators();

  /*
   * What the author has typed or uploaded, or null while they are still
   * looking at the starter code. Derived rather than seeded into state, so the
   * fetched template replaces the fallback when it arrives without an effect,
   * and without ever overwriting an edit in progress.
   */
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  /*
   * The fragment halves, seeded from the template like `source` is. Held
   * separately so switching tabs does not discard either: a member who starts
   * in fragment mode and opens "Write code" to look at the generated file must
   * find their body still there when they switch back.
   */
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<IndicatorSpec[] | null>(null);
  const body = bodyOverride ?? editing?.body ?? template.data?.body ?? '';
  const indicatorRows = indicators ?? editing?.indicators ?? template.data?.indicators ?? [];
  // `state` is not editable yet: the starter declares what its body uses, and
  // a member adding their own is the next thing this form grows. Carried
  // through so the seeded fragment keeps working.
  const state = editing?.state ?? template.data?.state ?? {};
  const draftCheck = useCheckDraft();
  const submitDraftMutation = useSubmitDraft();
  // When editing, the saved source is the starting point and the template is
  // irrelevant — an author fixing one line must not be handed the example back.
  const source = sourceOverride ?? editing?.source ?? template.data?.source ?? FALLBACK_TEMPLATE;
  /*
   * The whole-file editor shows the file from its class onward. The imports
   * are still part of `source` — the single source of truth for what gets
   * submitted — they are just not on screen unless asked for, or unless a
   * problem lands in them.
   */
  const [showPrelude, setShowPrelude] = useState(false);
  const split = splitPrelude(source);

  /*
   * The verdict belongs to the exact text it was computed from. Holding the
   * source alongside it means a single edit retires the answer, instead of a
   * green tick sitting above code that has changed since it was checked, which
   * is the one way this feature could actively mislead someone.
   */
  const [checkedSource, setCheckedSource] = useState<string | null>(null);
  const active = mode === 'fragment' ? draftCheck : check;
  // One pair of states drives the button and the panels, whichever path the
  // member is on.
  const activeSubmit = mode === 'fragment' ? submitDraftMutation : submit;
  const verdict: StrategyCheckResult | null =
    active.data && checkedSource === (mode === 'fragment' ? body : source) ? active.data : null;

  /*
   * Shown when asked for — or forced on screen when the check reports a problem
   * inside the hidden lines. An uploaded file can have a banned import up
   * there, and pointing at a line the member cannot see is worse than not
   * hiding anything.
   */
  const problemInPrelude =
    split.lines > 0 &&
    (verdict?.issues ?? []).some((issue) => issue.line > 0 && issue.line <= split.lines);
  const preludeVisible = showPrelude || problemInPrelude;

  const nameId = useId();
  const descriptionId = useId();
  const sourceId = useId();
  const bodyId = useId();
  const errorId = useId();

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      setError(`${file.name} is not a Python file. Strategies must be .py.`);
      return;
    }

    // Checked before reading, so an enormous file is rejected rather than
    // pulled into memory first.
    if (file.size > MAX_SOURCE_BYTES) {
      setError('That file is too large. Strategies are capped at 256 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setError(`Could not read ${file.name}.`);
    };
    reader.onload = () => {
      setSourceOverride(typeof reader.result === 'string' ? reader.result : '');
      setFilename(file.name);
      // Uploading drops you into the editor rather than submitting blind, so
      // the author sees what is about to be sent under their name.
      setMode('write');
      if (!name) setName(file.name.replace(/\.py$/i, ''));
    };
    reader.readAsText(file);
  }

  function handleCheck() {
    setError(null);

    // Fragment mode checks the fragment: the backend assembles it and reports
    // problems against the body, which is the only reason to author this way.
    if (mode === 'fragment') {
      const draft = strategyDraftSchema.safeParse({ body, indicators: indicatorRows, state });
      if (!draft.success) {
        setError(draft.error.issues[0]?.message ?? 'Check the indicator rows and try again.');
        return;
      }
      setCheckedSource(body);
      draftCheck.mutate(draft.data);
      return;
    }

    const parsed = strategyCheckRequestSchema.safeParse({ source, filename });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Add some code, or upload a file.');
      return;
    }

    setCheckedSource(source);
    check.mutate(parsed.data);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Recording the submission is identical either way — the run outlives the
    // editor regardless of how the source was authored.
    const onSuccess = (result: StrategySubmissionResult) => {
      remember({
        strategyKey: result.id,
        name: result.name,
        validationRunId: result.validationRunId,
      });
    };

    if (mode === 'fragment') {
      const draft = strategyDraftSchema.safeParse({ body, indicators: indicatorRows, state });
      if (!draft.success || !name.trim()) {
        setError(
          !name.trim()
            ? 'Give the strategy a name.'
            : (draft.error?.issues[0]?.message ?? 'Check the indicator rows and try again.'),
        );
        return;
      }
      submitDraftMutation.mutate(
        { ...draft.data, name: name.trim(), description },
        { onSuccess },
      );
      return;
    }

    const parsed = strategySubmissionSchema.safeParse({ name, description, source, filename });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }

    submit.mutate(parsed.data, {
      // Written to storage before this component can unmount: the run
      // outlives the editor, and the shell's notice is what reports it if the
      // author navigates away or closes the window.
      onSuccess,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {editing ? (
        <p className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-muted-foreground">
          Editing the saved source of <strong>{editing.name}</strong>. Saving registers this as a
          new strategy and starts its own validation run — the original is left alone, and can be
          removed from its menu once this one passes.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Strategy name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Volatility Momentum"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={descriptionId} className="text-sm font-medium">
            Description <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id={descriptionId}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            placeholder="What edge is this trying to capture?"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Two ways in, one payload out: upload reads into the same editor. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          <ModeTab
            active={mode === 'fragment'}
            onClick={() => {
              setMode('fragment');
            }}
            icon={PencilLine}
          >
            Write OnData
          </ModeTab>
          <ModeTab
            active={mode === 'write'}
            onClick={() => {
              setMode('write');
            }}
            icon={FileCode}
          >
            Whole file
          </ModeTab>
          <ModeTab
            active={mode === 'upload'}
            onClick={() => {
              setMode('upload');
            }}
            icon={FileUp}
          >
            Upload file
          </ModeTab>
        </div>

        {filename ? (
          <span className="text-xs text-muted-foreground">
            Loaded from <span className="font-mono">{filename}</span>
          </span>
        ) : null}
      </div>

      {mode === 'fragment' ? (
        <div className="space-y-4">
          <IndicatorRows
            value={indicatorRows}
            onChange={setIndicators}
            // The engine's own list. Falls back to the names the starter uses
            // if the endpoint cannot be reached — a shorter list is better
            // than an empty one, and the API validates the choice regardless.
            available={
              engineIndicators.data ??
              (template.data?.indicators ?? []).map((spec) => spec.indicator)
            }
          />

          <div className="space-y-1.5">
            <label htmlFor={bodyId} className="text-sm font-medium">
              OnData body
            </label>
            <p className="text-xs text-muted-foreground">
              The statements inside <code className="tabular">OnData</code>, at the left margin.
              Everything around them is generated — which is why a reported line number is a line
              you wrote.
            </p>
            <textarea
              id={bodyId}
              value={body}
              onChange={(event) => {
                setBodyOverride(event.target.value);
              }}
              spellCheck={false}
              rows={16}
              className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Collapsed by default: the generated file is reassurance, not the
              thing being edited. Rendered from the API's own assembledSource,
              never rebuilt here — a second assembler is exactly the drift the
              duplicated template already cost this repo once. */}
          {draftCheck.data?.assembledSource ? (
            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
                Show generated file
              </summary>
              <pre className="overflow-x-auto border-t p-3 font-mono text-[11px] leading-relaxed">
                {draftCheck.data.assembledSource}
              </pre>
            </details>
          ) : null}
        </div>
      ) : mode === 'write' ? (
        <div className="space-y-1.5">
          <label htmlFor={sourceId} className="sr-only">
            Strategy source code
          </label>

          {split.lines > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {preludeVisible
                  ? 'Showing the whole file, imports included.'
                  : `${String(split.lines)} lines of imports above the class are hidden.`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowPrelude((shown) => !shown);
                }}
                className="cursor-pointer underline-offset-4 hover:underline"
              >
                {preludeVisible ? 'Hide imports' : 'Show imports'}
              </button>
            </div>
          ) : null}

          <textarea
            id={sourceId}
            value={preludeVisible ? source : split.visible}
            onChange={(event) => {
              // The hidden prelude is put back unchanged, so what is submitted
              // is always the whole file — including an uploaded file's own
              // imports, which a canned header would have discarded.
              setSourceOverride(
                preludeVisible ? event.target.value : split.prelude + event.target.value,
              );
              setFilename(null);
            }}
            spellCheck={false}
            rows={20}
            // Off by default in textareas, and mandatory for code.
            className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-10 text-center transition-colors hover:bg-accent/40"
        >
          <FileUp className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Choose a .py file</p>
          <p className="text-xs text-muted-foreground">
            Up to 256 KB. It opens in the editor so you can check it before submitting.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".py,text/x-python"
            onChange={handleFile}
            className="sr-only"
          />
        </div>
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-[var(--loss)]">
          {error}
        </p>
      ) : null}

      {verdict ? <CompatibilityPanel result={verdict} ownLines={mode === 'fragment'} /> : null}

      {check.isError ? (
        <p role="alert" className="text-sm text-[var(--loss)]">
          The check could not run: {check.error.message}
        </p>
      ) : null}

      {/* Saving is only half the answer — the validation run decides whether
          this becomes selectable or stays an invisible draft. */}
      {activeSubmit.isSuccess ? <ValidationOutcome result={activeSubmit.data} /> : null}

      {activeSubmit.isError ? (
        <p role="alert" className="text-sm text-[var(--loss)]">
          {activeSubmit.error.message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={activeSubmit.isPending}>
          {activeSubmit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
          Save strategy
        </Button>
        {/*
          Offered rather than enforced. Saving already runs the same scan on the
          backend and answers 422 when it fails, so gating the form on a check
          would only make the slow path mandatory. This is the fast answer for
          anyone who wants it first.
        */}
        <Button type="button" variant="outline" onClick={handleCheck} disabled={check.isPending}>
          {check.isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
          Check compatibility
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            // Back to the derived starter code, whichever one that is.
            setSourceOverride(null);
            setFilename(null);
            setError(null);
          }}
        >
          Reset to template
        </Button>
      </div>
    </form>
  );
}

/**
 * The verdict. The reasons behind it are for developers only.
 *
 * The check answers one question for a member writing a strategy: will this run
 * here, yes or no. It deliberately does not tell them how to fix it. The
 * per-line diagnostics name internals (the import allowlist, the `OnData`
 * signature, the base class the engine expects) and reading them as
 * instructions leads someone
 * to edit their strategy to satisfy a scanner rather than to express an idea.
 * A member who gets "not compatible" should ask a dev, and the dev has the
 * detail.
 *
 * "Developer" here means a development build. That is a UI gate, not a security
 * boundary: the issues are still in the response body, so anyone who opens the
 * network tab can read them. That is the right level for this. The detail is
 * not secret, it is just noise aimed at the wrong reader, and a backend that
 * withheld it would also withhold it from the dev debugging in production.
 */
function CompatibilityPanel({
  result,
  ownLines,
}: {
  result: StrategyCheckResult;
  /**
   * Whether the reported lines belong to the member.
   *
   * The dev-only gate below exists because on the full-file path the
   * diagnostics point into generated boilerplate and name internals — reading
   * them as instructions leads someone to edit their strategy to satisfy a
   * scanner. In fragment mode that reasoning inverts: `L7` is line 7 of the
   * body they typed, and hiding it would withhold the one thing that makes
   * this mode worth having.
   */
  ownLines: boolean;
}) {
  const tone =
    result.status === 'compatible'
      ? {
          icon: CircleCheck,
          border: 'border-[var(--profit)]/40',
          text: 'text-[var(--profit)]',
          label: 'Compatible',
        }
      : result.status === 'incompatible'
        ? {
            icon: CircleX,
            border: 'border-[var(--loss)]/40',
            text: 'text-[var(--loss)]',
            label: 'Not compatible',
          }
        : // `unchecked`: fixture mode, where there is no backend to ask. Neutral
          // on purpose: it is neither a pass nor a complaint about the code.
          {
            icon: AlertTriangle,
            border: 'border-input',
            text: 'text-muted-foreground',
            label: 'Not checked',
          };

  const Icon = tone.icon;

  return (
    <div role="status" className={cn('space-y-3 rounded-md border p-3', tone.border)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 size-4 shrink-0', tone.text)} aria-hidden />
        <div className="space-y-0.5">
          <p className={cn('text-sm font-medium', tone.text)}>
            {tone.label}
            {result.className ? (
              <span className="font-mono font-normal text-muted-foreground">
                {' '}
                · {result.className}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">{result.message}</p>
        </div>
      </div>

      {(ownLines || env.isDev) && result.issues.length > 0 ? (
        <IssueList
          title={ownLines ? 'Fix these lines' : 'Issues (dev only)'}
          issues={result.issues}
          className="text-[var(--loss)]"
        />
      ) : null}

      {(ownLines || env.isDev) && result.warnings.length > 0 ? (
        <IssueList
          title={ownLines ? 'Worth a look' : 'Warnings (dev only)'}
          issues={result.warnings}
          className="text-muted-foreground"
        />
      ) : null}
    </div>
  );
}

function IssueList({
  title,
  issues,
  className,
}: {
  title: string;
  issues: CompatibilityIssue[];
  className: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul className="space-y-1">
        {issues.map((issue) => (
          <li key={`${String(issue.line)}-${issue.message}`} className="flex gap-2 text-sm">
            {/* Line 0 means "the file", not the first line, so no number. */}
            {issue.line > 0 ? (
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                L{issue.line}
              </span>
            ) : null}
            <span className={className}>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileUp;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-selected font-medium text-selected-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  );
}
