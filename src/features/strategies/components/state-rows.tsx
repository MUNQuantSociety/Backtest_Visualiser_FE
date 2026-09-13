import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The state half of a draft: the attributes a body wants to carry between bars,
 * and the default each is initialised to.
 *
 * A form rather than a block of Python, for the same reason as the indicator
 * rows. The name becomes an attribute the body reads as `self.<name>`, so it is
 * constrained to a plain identifier; the default is a value `BasePortfolio`
 * deep-copies onto the instance, chosen here by shape rather than typed as an
 * arbitrary Python expression.
 */

/** One entry of the generated class's `STATE`. */
export interface StateEntry {
  /** The attribute the body reads: `self.<attribute>`. */
  attribute: string;
  /** Its default, rendered into the generated file as a Python literal. */
  value: unknown;
}

/**
 * The shapes a per-run default is almost always born as.
 *
 * Offered as a dropdown, not a free text box: whatever the member can express
 * in it is what `repr` puts in the generated file, and these are the shapes a
 * strategy actually starts with. A value an existing draft already holds is
 * added as its own option, so opening the form never changes it.
 */
const DEFAULT_CHOICES: { label: string; value: unknown }[] = [
  { label: '{} — a dict, like per-ticker storage', value: {} },
  { label: '[] — a list', value: [] },
  { label: '0 — a count', value: 0 },
  { label: '"" — a string', value: '' },
];

function choicesFor(current: unknown): { label: string; value: unknown }[] {
  const currentIsAChoice = DEFAULT_CHOICES.some(
    (choice) => JSON.stringify(choice.value) === JSON.stringify(current),
  );
  return currentIsAChoice
    ? DEFAULT_CHOICES
    : [...DEFAULT_CHOICES, { label: String(current), value: current }];
}

export function StateRows({
  value,
  onChange,
}: {
  value: readonly StateEntry[];
  onChange: (next: StateEntry[]) => void;
}) {
  function update(index: number, patch: Partial<StateEntry>) {
    onChange(value.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        State <span className="text-muted-foreground">(optional)</span>
      </legend>
      <p className="text-xs text-muted-foreground">
        What the body remembers between bars, read as{' '}
        <code className="tabular">self.&lt;name&gt;</code>. The default is copied per run.
      </p>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          None yet. A strategy can trade without keeping anything between bars.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((entry, index) => (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3 rounded-md border border-border p-2.5"
            >
              <Field label="Name in code" index={index} suffix="name in code">
                <input
                  aria-label={`State ${String(index + 1)} name in code`}
                  value={entry.attribute}
                  onChange={(event) => {
                    update(index, { attribute: event.target.value });
                  }}
                  placeholder="last_price"
                  className="tabular h-8 w-36 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>

              <Field label="Default" index={index} suffix="default">
                <select
                  aria-label={`State ${String(index + 1)} default`}
                  value={JSON.stringify(entry.value)}
                  onChange={(event) => {
                    const choice = choicesFor(entry.value).find(
                      (candidate) => JSON.stringify(candidate.value) === event.target.value,
                    );
                    update(index, { value: choice?.value ?? entry.value });
                  }}
                  className="tabular h-8 min-w-52 cursor-pointer rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {choicesFor(entry.value).map((choice) => (
                    <option key={JSON.stringify(choice.value)} value={JSON.stringify(choice.value)}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove state ${entry.attribute || String(index + 1)}`}
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
        onClick={() => {
          onChange([...value, { attribute: '', value: {} }]);
        }}
      >
        <Plus className="mr-2 size-4" aria-hidden />
        Add state
      </Button>
    </fieldset>
  );
}

/**
 * A control with its own label above it.
 *
 * Same construction as the indicator rows: each row carries its own labels
 * rather than the fieldset having one header, so a row never mislabels its
 * neighbour's value.
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
    <label className="flex flex-col gap-1" htmlFor={`state-${String(index)}-${suffix}`}>
      <span className="text-[9px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
