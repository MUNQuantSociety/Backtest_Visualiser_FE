/** Display formatting. Pure functions only — no React, no imports from features. */

const DEFAULT_LOCALE = 'en-US';

export function formatCurrency(
  value: number,
  currency = 'USD',
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

/** `0.1234` -> `"12.34%"`. Pass a value already in percent? Divide it first. */
export function formatPercent(ratio: number, fractionDigits = 2): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

export function formatNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** `1_250_000` -> `"1.25M"`. For axis ticks and stat tiles. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

/** Always shows an explicit sign, so a positive return reads as "+4.20%". */
export function formatSigned(value: number, formatter: (n: number) => string): string {
  const formatted = formatter(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatDuration(days: number): string {
  if (days < 1) return `${String(Math.round(days * 24))}h`;
  if (days < 30) return `${String(Math.round(days))}d`;
  if (days < 365) return `${String(Math.round(days / 30))}mo`;
  return `${formatNumber(days / 365, 1)}y`;
}

/**
 * "now", "3h", "yesterday", "5d ago", or the date once it is old enough that
 * a count of days stops meaning anything. For "last run" and "when" columns.
 */
export function formatRelativeDay(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${String(days)}d ago`;
  return iso.slice(0, 10);
}
