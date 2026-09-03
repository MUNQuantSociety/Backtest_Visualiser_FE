import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Names the group for assistive tech; the labels alone say only "1Y". */
  ariaLabel: string;
  className?: string | undefined;
}

/**
 * A row of mutually exclusive choices — period, sort, mode.
 *
 * A radio group, not a tab list: choosing a segment changes a parameter of the
 * view rather than swapping which view is shown, and arrow keys should move
 * the selection the way they do between radios.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center rounded-md border border-border p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              'tabular cursor-pointer rounded-sm px-2.5 py-1 text-xs transition-colors',
              active
                ? 'bg-selected font-medium text-selected-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
