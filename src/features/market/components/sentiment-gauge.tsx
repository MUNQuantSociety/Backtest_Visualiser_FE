import { formatSigned } from '@/utils/format';

/**
 * Where a score in [-1, 1] sits on a loss → muted → profit ramp.
 * Used for the book as a whole; per-ticker scores get the diverging bar.
 */
export function SentimentGauge({ label, score }: { label: string; score: number }) {
  const clamped = Math.max(-1, Math.min(1, score));
  const left = `${String(50 + clamped * 50)}%`;
  const text = formatSigned(clamped, (n) => n.toFixed(2));
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label} <span className="tabular text-foreground">{text}</span>
      </span>
      <div
        className="relative h-1.5 w-[150px] rounded-full"
        style={{
          background:
            'linear-gradient(90deg, var(--loss) 0%, var(--muted) 50%, var(--profit) 100%)',
        }}
        role="img"
        aria-label={`${label} ${text}`}
      >
        <span
          className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-foreground"
          style={{ left }}
        />
      </div>
    </div>
  );
}

/** Centred diverging bar for a single signed score in [-1, 1]. */
export function DivergingBar({ value, width = 96 }: { value: number; width?: number | undefined }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const half = width / 2;
  const fill = Math.abs(clamped) * half;
  return (
    <div className="relative h-1.5 rounded-full bg-muted" style={{ width }} aria-hidden>
      <span className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border-strong)]" />
      <span
        className="absolute top-0 bottom-0 rounded-full"
        style={{
          left: clamped >= 0 ? half : half - fill,
          width: fill,
          background: clamped >= 0 ? 'var(--profit)' : 'var(--loss)',
        }}
      />
    </div>
  );
}
