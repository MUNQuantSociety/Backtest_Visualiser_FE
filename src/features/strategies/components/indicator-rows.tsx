import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { IndicatorDefinition, IndicatorSpec } from '../types';

/**
 * The indicator half of a draft: attribute, engine class, parameters.
 *
 * A form rather than a block of Python, because these are the one part of a
 * strategy the backend can validate *before* anything runs — a name the engine
 * does not ship is a field error on the row, not a `ModuleNotFoundError` in a
 * backtest twenty minutes later.
 *
 * `attribute` is what the body reads (`self.fast_sma[ticker]`), which is why it
 * is constrained to an identifier here and again in the API: it is rendered
 * straight into the generated class.
 *
 * Parameters come from the catalogue, one labelled control each. They used to
 * be one box of raw JSON — which asked a member to know both the key names and
 * the syntax, and silently ignored anything half-typed.
 */

/**
 * Values offered for a numeric parameter.
 *
 * A dropdown rather than a number box: these are periods in bars, and the
 * useful ones are conventional (14 for RSI, 20/50/200 for moving averages).
 * A free field invites 37, which is not wrong but is rarely meant. Whatever
 * value a spec already holds is added, so an existing draft never has its
 * number quietly changed by opening the form.
 */
const PERIOD_CHOICES = [2, 3, 5, 7, 9, 10, 12, 14, 20, 26, 30, 50, 100, 200] as const;

function choicesFor(current: unknown): number[] {
  const values = new Set<number>(PERIOD_CHOICES);
  if (typeof current === 'number') values.add(current);
  return [...values].sort((left, right) => left - right);
}

/** A label a person reads, from a key the engine uses. */
function labelFor(key: string): string {
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function IndicatorRows({
  value,
  onChange,
  available,
}: {
  value: readonly IndicatorSpec[];
  onChange: (next: IndicatorSpec[]) => void;
  /**
   * The engine's indicator classes and what each accepts, from
   * `GET /strategies/indicators`. A select rather than free text: every valid
   * choice is known, so offering anything else only invites a 422.
   */
  available: readonly IndicatorDefinition[];
}) {
  function update(index: number, patch: Partial<IndicatorSpec>) {
    onChange(value.map((spec, at) => (at === index ? { ...spec, ...patch } : spec)));
  }

  /** The numeric parameters a class takes; column plumbing is left alone. */
  function tunable(indicator: string) {
    return (available.find((definition) => definition.name === indicator)?.parameters ?? []).filter(
      (parameter) => parameter.kind === 'number',
    );
  }

  /** Defaults for a class, so switching indicator does not carry stale keys. */
  function defaultsFor(indicator: string): Record<string, unknown> {
    return Object.fromEntries(
      tunable(indicator).map((parameter) => [parameter.key, parameter.default ?? 14]),
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        Indicators <span className="text-muted-foreground">(optional)</span>
      </legend>
      <p className="text-xs text-muted-foreground">
        One instance per ticker. Read them in the body as{' '}
        <code className="tabular">self.&lt;name&gt;[ticker]</code>.
      </p>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          None yet. A strategy can trade without them — add one when the body needs it.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((spec, index) => (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3 rounded-md border border-border p-2.5"
            >
              <Field label="Name in code" index={index} suffix="name in code">
                <input
                  aria-label={`Indicator ${String(index + 1)} name in code`}
                  value={spec.attribute}
                  onChange={(event) => {
                    update(index, { attribute: event.target.value });
                  }}
                  placeholder="fast_sma"
                  className="tabular h-8 w-36 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>

              <Field label="Indicator" index={index} suffix="class">
                <select
                  aria-label={`Indicator ${String(index + 1)} class`}
                  value={spec.indicator}
                  onChange={(event) => {
                    // Parameters belong to the class, so switching resets them
                    // to that class's defaults rather than keeping keys the
                    // new one never reads.
                    update(index, {
                      indicator: event.target.value,
                      params: defaultsFor(event.target.value),
                    });
                  }}
                  className="tabular h-8 min-w-52 cursor-pointer rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* A name the engine no longer ships stays selectable, so an
                      old draft does not silently switch indicator on open. */}
                  {(available.some((definition) => definition.name === spec.indicator) ||
                  !spec.indicator
                    ? available.map((definition) => definition.name)
                    : [spec.indicator, ...available.map((definition) => definition.name)]
                  ).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>

              {tunable(spec.indicator).map((parameter) => (
                <Field
                  key={parameter.key}
                  label={labelFor(parameter.key)}
                  index={index}
                  suffix={parameter.key}
                >
                  <select
                    aria-label={`Indicator ${String(index + 1)} ${parameter.key}`}
                    value={String(spec.params[parameter.key] ?? parameter.default ?? '')}
                    onChange={(event) => {
                      update(index, {
                        params: { ...spec.params, [parameter.key]: Number(event.target.value) },
                      });
                    }}
                    className="tabular h-8 w-24 cursor-pointer rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {choicesFor(spec.params[parameter.key] ?? parameter.default).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}

              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove indicator ${spec.attribute || String(index + 1)}`}
                onClick={() => {
                  onChange(value.filter((_, at) => at !== index));
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={available.length === 0}
        title={available.length === 0 ? 'The engine’s indicator list could not be loaded.' : undefined}
        onClick={() => {
          const first = available[0]?.name ?? '';
          onChange([...value, { attribute: '', indicator: first, params: defaultsFor(first) }]);
        }}
      >
        <Plus className="mr-2 size-4" aria-hidden />
        Add indicator
      </Button>
    </fieldset>
  );
}

/**
 * A control with its own label above it.
 *
 * Each row carries its own labels rather than the grid having one header:
 * different indicators take different parameters, so the columns are not the
 * same from row to row and a shared header would mislabel them.
 */
function Field({
  label,
  index,
  suffix,
  children,
}: {
  label: string;
  index: number;
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1" htmlFor={`indicator-${String(index)}-${suffix}`}>
      <span className="text-[9px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
