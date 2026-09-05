import { AlertTriangle, CircleCheck, CircleX, FileUp, Loader2, PencilLine } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { env } from '@/config/env';
import { cn } from '@/lib/utils';

import { useCheckStrategy, useStrategyTemplate, useSubmitStrategy } from '../strategies-api';
import {
  MAX_SOURCE_BYTES,
  strategyCheckRequestSchema,
  strategySubmissionSchema,
  type CompatibilityIssue,
  type StrategyCheckResult,
} from '../types';

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
const FALLBACK_TEMPLATE = `import logging

from engine.strategies.order_interface import StrategyContext
from engine.strategies.portfolio_BASE.strategy import BasePortfolio


class MyStrategy(BasePortfolio):
    """One sentence on what edge this is trying to capture."""

    def __init__(
        self,
        db_connector,
        executor,
        debug=False,
        config_dict=None,
        backtest_start_date=None,
        order_manager=None,
    ):
        # BasePortfolio is what reads the config: self.tickers, self.lookback_days
        # and the indicator machinery all come out of this call.
        super().__init__(
            db_connector, executor, debug, config_dict, backtest_start_date, order_manager
        )
        self.logger = logging.getLogger(self.__class__.__name__)

        # "attribute_name": ("IndicatorName", {parameters})
        self.RegisterIndicatorSet({
            "fast_sma": ("SimpleMovingAverage", {"period": 20}),
            "slow_sma": ("SimpleMovingAverage", {"period": 50}),
        })

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
`;

const ACCEPTED_EXTENSIONS = ['.py'];

type Mode = 'write' | 'upload';

export function StrategyEditor() {
  const [mode, setMode] = useState<Mode>('write');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmitStrategy();
  const check = useCheckStrategy();
  const template = useStrategyTemplate();

  /*
   * What the author has typed or uploaded, or null while they are still
   * looking at the starter code. Derived rather than seeded into state, so the
   * fetched template replaces the fallback when it arrives without an effect,
   * and without ever overwriting an edit in progress.
   */
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  const source = sourceOverride ?? template.data?.source ?? FALLBACK_TEMPLATE;

  /*
   * The verdict belongs to the exact text it was computed from. Holding the
   * source alongside it means a single edit retires the answer, instead of a
   * green tick sitting above code that has changed since it was checked, which
   * is the one way this feature could actively mislead someone.
   */
  const [checkedSource, setCheckedSource] = useState<string | null>(null);
  const verdict: StrategyCheckResult | null =
    check.data && checkedSource === source ? check.data : null;

  const nameId = useId();
  const descriptionId = useId();
  const sourceId = useId();
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

    const parsed = strategySubmissionSchema.safeParse({ name, description, source, filename });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }

    submit.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            active={mode === 'write'}
            onClick={() => {
              setMode('write');
            }}
            icon={PencilLine}
          >
            Write code
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

      {mode === 'write' ? (
        <div className="space-y-1.5">
          <label htmlFor={sourceId} className="sr-only">
            Strategy source code
          </label>
          <textarea
            id={sourceId}
            value={source}
            onChange={(event) => {
              setSourceOverride(event.target.value);
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

      {verdict ? <CompatibilityPanel result={verdict} /> : null}

      {check.isError ? (
        <p role="alert" className="text-sm text-[var(--loss)]">
          The check could not run: {check.error.message}
        </p>
      ) : null}

      {submit.isSuccess ? (
        <p role="status" className="text-sm text-[var(--profit)]">
          {submit.data.message || `Saved "${submit.data.name}".`}
        </p>
      ) : null}

      {submit.isError ? (
        <p role="alert" className="text-sm text-[var(--loss)]">
          {submit.error.message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
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
 * signature, `super().__init__`) and reading them as instructions leads someone
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
function CompatibilityPanel({ result }: { result: StrategyCheckResult }) {
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

      {env.isDev && result.issues.length > 0 ? (
        <IssueList
          title="Issues (dev only)"
          issues={result.issues}
          className="text-[var(--loss)]"
        />
      ) : null}

      {env.isDev && result.warnings.length > 0 ? (
        <IssueList
          title="Warnings (dev only)"
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
