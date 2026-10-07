import { Code2, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  blankRules,
  COMPARISONS,
  compileRules,
  describeRules,
  MAX_CONDITIONS,
  MAX_PERIOD,
  MIN_PERIOD,
  RULE_INDICATOR_NAMES,
  RULE_INDICATORS,
  RULE_TEMPLATES,
  rulesProblems,
  type Comparison,
  type Condition,
  type Operand,
  type RuleGroup,
  type StrategyRules,
} from '../rules';
import { useSubmitDraft } from '../strategies-api';
import type { StrategySubmissionResult } from '../types';
import { useSubmissions } from '../use-submissions';

import { ValidationOutcome } from './validation-outcome';

const FIELD =
  'h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Build a strategy by choosing rules, no code.
 *
 * Pick a starting point, adjust the buy and sell conditions from dropdowns,
 * optionally add a stop-loss and take-profit, and save. The rules compile to
 * the same fragment the code editor sends, so saving starts the same
 * validation run, and the result is picked in Run backtest like any other.
 */
export function RuleBuilder() {
  const [rules, setRules] = useState<StrategyRules>(() =>
    structuredClone(RULE_TEMPLATES[0]!.rules),
  );
  const [templateId, setTemplateId] = useState<string | null>(RULE_TEMPLATES[0]!.id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const submit = useSubmitDraft();
  const { remember } = useSubmissions();
  const nameId = useId();
  const descriptionId = useId();

  const problems = rulesProblems(rules);
  const draft = problems.length === 0 ? compileRules(rules) : null;

  function update(next: StrategyRules) {
    setRules(next);
    setTemplateId(null);
    // A result shown under rules that have since changed would describe a different strategy.
    submit.reset();
  }

  function startFrom(id: string | null) {
    const template = RULE_TEMPLATES.find((candidate) => candidate.id === id);
    setRules(template ? structuredClone(template.rules) : blankRules());
    setTemplateId(id);
    if (template && !name) setName(template.name);
    if (template && !description) setDescription(template.idea);
    submit.reset();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Give the strategy a name.');
      return;
    }
    if (!draft) {
      setError(problems[0] ?? 'Check the rules and try again.');
      return;
    }
    submit.mutate(
      { ...draft, name: name.trim(), description: description.trim() },
      {
        onSuccess: (result: StrategySubmissionResult) => {
          remember({
            strategyKey: result.id,
            name: result.name,
            validationRunId: result.validationRunId,
          });
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">1. Start from an idea</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {RULE_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              selected={templateId === template.id}
              title={template.name}
              idea={template.idea}
              onClick={() => {
                startFrom(template.id);
              }}
            />
          ))}
          <TemplateCard
            selected={false}
            title="Blank"
            idea="Start with one buy and one sell rule and make it your own."
            onClick={() => {
              startFrom(null);
            }}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">2. Set your rules</legend>
        <GroupEditor
          side="buy"
          group={rules.buy}
          onChange={(buy) => {
            update({ ...rules, buy });
          }}
        />
        <GroupEditor
          side="sell"
          group={rules.sell}
          onChange={(sell) => {
            update({ ...rules, sell });
          }}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">3. Protect each trade (optional)</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <PercentToggle
            label="Stop-loss"
            help="Sell if a holding falls this far below what it cost."
            value={rules.stopLossPercent}
            fallback={10}
            onChange={(stopLossPercent) => {
              update({ ...rules, stopLossPercent });
            }}
          />
          <PercentToggle
            label="Take-profit"
            help="Sell if a holding rises this far above what it cost."
            value={rules.takeProfitPercent}
            fallback={20}
            onChange={(takeProfitPercent) => {
              update({ ...rules, takeProfitPercent });
            }}
          />
        </div>
      </fieldset>

      <section
        aria-label="Your strategy in plain English"
        className="space-y-1 rounded-md border border-border bg-background px-4 py-3 text-sm"
      >
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          In plain English
        </p>
        {problems.length === 0 ? (
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {describeRules(rules).map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>It only ever owns a stock or holds cash; it never sells short.</li>
          </ul>
        ) : (
          <ul role="alert" className="list-disc space-y-0.5 pl-5 text-[var(--loss)]">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            4. Name it
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            maxLength={80}
            placeholder="My first strategy"
            className={cn(FIELD, 'w-full px-3')}
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
            maxLength={500}
            placeholder="What is the idea?"
            className={cn(FIELD, 'w-full px-3')}
          />
        </div>
      </div>

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
      {submit.data ? <ValidationOutcome result={submit.data} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={submit.isPending || draft === null}>
          {submit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
          Save strategy
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={showCode}
          onClick={() => {
            setShowCode((shown) => !shown);
          }}
        >
          <Code2 className="mr-2 size-4" aria-hidden />
          {showCode ? 'Hide the code' : 'Show the code this creates'}
        </Button>
      </div>
      {showCode && draft ? (
        <pre className="max-h-96 overflow-auto rounded-md border bg-background p-3 font-mono text-xs">
          {draft.body}
        </pre>
      ) : null}
    </form>
  );
}

function TemplateCard({
  selected,
  title,
  idea,
  onClick,
}: {
  selected: boolean;
  title: string;
  idea: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-primary bg-selected text-selected-foreground'
          : 'border-border hover:bg-muted/60',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{idea}</span>
    </button>
  );
}

function GroupEditor({
  side,
  group,
  onChange,
}: {
  side: 'buy' | 'sell';
  group: RuleGroup;
  onChange: (group: RuleGroup) => void;
}) {
  const verb = side === 'buy' ? 'Buy' : 'Sell';
  const matchId = useId();

  function setCondition(index: number, condition: Condition) {
    onChange({
      ...group,
      conditions: group.conditions.map((existing, at) => (at === index ? condition : existing)),
    });
  }

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border-l-2 bg-background px-3 py-3',
        side === 'buy' ? 'border-l-[var(--profit)]' : 'border-l-[var(--loss)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{verb} when</span>
        {group.conditions.length > 1 ? (
          <>
            <label htmlFor={matchId} className="sr-only">
              {`How the ${side} conditions combine`}
            </label>
            <select
              id={matchId}
              value={group.match}
              onChange={(event) => {
                onChange({ ...group, match: event.target.value as RuleGroup['match'] });
              }}
              className={FIELD}
            >
              <option value="all">all of these are true</option>
              <option value="any">any of these is true</option>
            </select>
          </>
        ) : (
          <span className="text-muted-foreground">this is true</span>
        )}
      </div>
      <ul className="space-y-2">
        {group.conditions.map((condition, index) => (
          <li
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2"
          >
            <OperandPicker
              label={`${verb} condition ${String(index + 1)}, left side`}
              value={condition.left}
              onChange={(left) => {
                setCondition(index, { ...condition, left });
              }}
            />
            <select
              aria-label={`${verb} condition ${String(index + 1)}, comparison`}
              value={condition.comparison}
              onChange={(event) => {
                setCondition(index, { ...condition, comparison: event.target.value as Comparison });
              }}
              className={FIELD}
            >
              {Object.entries(COMPARISONS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <OperandPicker
              label={`${verb} condition ${String(index + 1)}, right side`}
              value={condition.right}
              onChange={(right) => {
                setCondition(index, { ...condition, right });
              }}
            />
            {group.conditions.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${side} condition ${String(index + 1)}`}
                onClick={() => {
                  onChange({
                    ...group,
                    conditions: group.conditions.filter((_, at) => at !== index),
                  });
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {group.conditions.length < MAX_CONDITIONS ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange({
              ...group,
              conditions: [
                ...group.conditions,
                structuredClone(group.conditions.at(-1) ?? blankRules()[side].conditions[0]!),
              ],
            });
          }}
        >
          <Plus className="mr-1.5 size-3.5" aria-hidden />
          Add a condition
        </Button>
      ) : null}
    </div>
  );
}

/** "Price", an indicator with its period, or a fixed number. */
function OperandPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Operand;
  onChange: (operand: Operand) => void;
}) {
  const kind = value.kind === 'indicator' ? value.indicator : value.kind;
  const help = value.kind === 'indicator' ? RULE_INDICATORS[value.indicator].help : undefined;

  return (
    <span className="flex items-center gap-1" title={help}>
      <select
        aria-label={label}
        value={kind}
        onChange={(event) => {
          const next = event.target.value;
          if (next === 'price') onChange({ kind: 'price' });
          else if (next === 'number') onChange({ kind: 'number', value: 50 });
          else {
            const indicator = next as keyof typeof RULE_INDICATORS;
            onChange({
              kind: 'indicator',
              indicator,
              period: RULE_INDICATORS[indicator].defaultPeriod,
            });
          }
        }}
        className={FIELD}
      >
        <option value="price">Price</option>
        {RULE_INDICATOR_NAMES.map((indicator) => (
          <option key={indicator} value={indicator}>
            {RULE_INDICATORS[indicator].label}
          </option>
        ))}
        <option value="number">A number</option>
      </select>
      {value.kind === 'indicator' ? (
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="number"
            aria-label={`${label}, days`}
            min={MIN_PERIOD}
            max={MAX_PERIOD}
            step={1}
            value={Number.isFinite(value.period) ? value.period : ''}
            onChange={(event) => {
              onChange({ ...value, period: event.target.valueAsNumber });
            }}
            className={cn(FIELD, 'tabular w-16 text-foreground')}
          />
          days
        </label>
      ) : null}
      {value.kind === 'number' ? (
        <input
          type="number"
          aria-label={`${label}, value`}
          step="any"
          value={Number.isFinite(value.value) ? value.value : ''}
          onChange={(event) => {
            onChange({ kind: 'number', value: event.target.valueAsNumber });
          }}
          className={cn(FIELD, 'tabular w-20 text-foreground')}
        />
      ) : null}
    </span>
  );
}

function PercentToggle({
  label,
  help,
  value,
  fallback,
  onChange,
}: {
  label: string;
  help: string;
  value: number | null;
  fallback: number;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={value !== null}
        onChange={(event) => {
          onChange(event.target.checked ? fallback : null);
        }}
        className="size-4 accent-[var(--primary)]"
      />
      <label htmlFor={id} title={help}>
        {label}
      </label>
      {value !== null ? (
        <label className="flex items-center gap-1 text-muted-foreground">
          <input
            type="number"
            aria-label={`${label} percent`}
            min={1}
            max={99}
            step="any"
            value={Number.isFinite(value) ? value : ''}
            onChange={(event) => {
              onChange(event.target.valueAsNumber);
            }}
            className={cn(FIELD, 'tabular w-16 text-foreground')}
          />
          %
        </label>
      ) : null}
    </div>
  );
}
