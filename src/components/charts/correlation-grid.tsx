import { formatNumber } from '@/utils/format';

interface CorrelationGridProps {
  labels: readonly string[];
  /** Square matrix, same order as `labels`, values in [-1, 1]. */
  matrix: readonly (readonly number[])[];
  /** Token behind positive cells. `--chart-1` for strategies, per the spec. */
  positiveToken?: string | undefined;
  negativeToken?: string | undefined;
  /** Percent of the token at |ρ| = 1. */
  peakPercent?: number | undefined;
  /** Above this magnitude the cell is dark enough to need light text. */
  invertTextAbove?: number | undefined;
}

/**
 * Pairwise correlation as a shaded grid.
 *
 * Presentational only — the caller decides what the axes are and which token
 * means what, because the same grid reads differently by context: for a book
 * of strategies, positive is "one bet" and blue; for a portfolio's holdings the
 * risk convention flips it to red.
 */
export function CorrelationGrid({
  labels,
  matrix,
  positiveToken = '--chart-1',
  negativeToken = '--loss',
  peakPercent = 85,
  invertTextAbove = 0.6,
}: CorrelationGridProps) {
  if (labels.length < 2) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Fewer than two series to correlate.
      </p>
    );
  }

  const cellBackground = (value: number) => {
    const token = value >= 0 ? positiveToken : negativeToken;
    const percent = Math.round(Math.min(Math.abs(value), 1) * peakPercent);
    return `color-mix(in oklab, var(${token}) ${String(percent)}%, transparent)`;
  };

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `56px repeat(${String(labels.length)}, 1fr)` }}
    >
      <div />
      {labels.map((label) => (
        <div
          key={`h-${label}`}
          className="tabular truncate text-center text-[10px] font-medium text-muted-foreground"
        >
          {label}
        </div>
      ))}
      {labels.map((rowLabel, r) => (
        <div key={rowLabel} className="contents">
          <div className="tabular self-center truncate text-[10px] font-medium text-muted-foreground">
            {rowLabel}
          </div>
          {labels.map((colLabel, c) => {
            const value = matrix[r]?.[c];
            if (value === undefined) {
              return <div key={colLabel} className="h-10 rounded-[3px] bg-muted" />;
            }
            return (
              <div
                key={colLabel}
                title={`${rowLabel} vs ${colLabel}`}
                className="tabular flex h-10 items-center justify-center rounded-[3px] text-[11px]"
                style={{
                  background: cellBackground(value),
                  color: Math.abs(value) > invertTextAbove ? 'var(--background)' : undefined,
                }}
              >
                {formatNumber(value, 2)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
