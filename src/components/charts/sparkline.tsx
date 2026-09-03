interface SparklineProps {
  /** Nulls are gaps — a rolling window that has not filled yet. */
  values: readonly (number | null)[];
  width?: number | undefined;
  height?: number | undefined;
  /** Draw a horizontal tick at this value; the spec uses zero for Sharpe. */
  zeroTick?: number | undefined;
  stroke?: string | undefined;
  className?: string | undefined;
}

/**
 * A tiny inline line for a table cell. No axes, no tooltip: it exists to show
 * shape at a glance, and anything more belongs in a real chart.
 */
export function Sparkline({
  values,
  width = 84,
  height = 28,
  zeroTick,
  stroke = 'currentColor',
  className,
}: SparklineProps) {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const min = Math.min(...present, zeroTick ?? Number.POSITIVE_INFINITY);
  const max = Math.max(...present, zeroTick ?? Number.NEGATIVE_INFINITY);
  const span = max - min || 1;
  const pad = 2;
  const y = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  const step = (width - pad * 2) / (values.length - 1);

  let d = '';
  values.forEach((value, index) => {
    if (value === null) return;
    const x = pad + index * step;
    d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y(value).toFixed(1)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className={className}
      aria-hidden
    >
      {zeroTick !== undefined ? (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(zeroTick)}
          y2={y(zeroTick)}
          stroke="var(--border-strong)"
          strokeWidth={1}
        />
      ) : null}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}
