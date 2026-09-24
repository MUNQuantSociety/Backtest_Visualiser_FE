import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/format';

import { weightTotalPercent, type WeightMode, type WeightPercents } from './run-weights';

const WEIGHT_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'custom', label: 'Custom' },
] as const satisfies readonly { value: WeightMode; label: string }[];

const FULL_BOOK_PERCENT = 100;

interface WeightsFieldProps {
  universe: readonly string[];
  /** True once the universe differs from the strategy's own. */
  universeChanged: boolean;
  mode: WeightMode;
  percents: WeightPercents;
  onModeChange: (mode: WeightMode) => void;
  onPercentChange: (ticker: string, value: string) => void;
  onSplitEqually: () => void;
  /** Why the current custom weights would be refused, if they would be. */
  problem: string | null;
}

/**
 * The run form's weights: the default allocation, or a percentage per ticker.
 *
 * Says what "default" means for this run rather than leaving it abstract —
 * the strategy's own weights, or an equal split once the universe changed —
 * because that is exactly what the backend does when no weights are sent.
 */
export function WeightsField({
  universe,
  universeChanged,
  mode,
  percents,
  onModeChange,
  onPercentChange,
  onSplitEqually,
  problem,
}: WeightsFieldProps) {
  const total = weightTotalPercent(percents, universe);
  const cash = FULL_BOOK_PERCENT - total;

  return (
    <div className="space-y-2">
      <Segmented value={mode} options={WEIGHT_MODES} onChange={onModeChange} ariaLabel="Weights" />

      {mode === 'default' ? (
        <p className="text-[11px] text-muted-foreground">
          {universeChanged
            ? `Equal weight across the ${String(universe.length)} tickers you chose.`
            : "The strategy's own weights."}
        </p>
      ) : universe.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Pick a strategy to set its weights.</p>
      ) : (
        <>
          <ul aria-label="Ticker weights" className="grid gap-2 sm:grid-cols-3">
            {universe.map((ticker) => (
              <li key={ticker}>
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="tabular w-14 shrink-0 font-medium">{ticker}</span>
                  <span className="relative min-w-0 flex-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={FULL_BOOK_PERCENT}
                      step={0.01}
                      value={percents[ticker] ?? ''}
                      placeholder="0"
                      aria-label={`${ticker} weight`}
                      onChange={(event) => {
                        onPercentChange(ticker, event.target.value);
                      }}
                      className="tabular h-[30px] w-full rounded-md border border-input bg-background pr-7 pl-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                      %
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              aria-live="polite"
              className={cn(
                'tabular text-[11px]',
                problem ? 'text-[var(--loss)]' : 'text-muted-foreground',
              )}
            >
              {Number.isFinite(total)
                ? `Total ${formatNumber(total)}% · cash ${formatNumber(Math.max(0, cash))}%`
                : 'Total —'}
              {problem ? ` — ${problem}` : null}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onSplitEqually}>
              Split equally
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
