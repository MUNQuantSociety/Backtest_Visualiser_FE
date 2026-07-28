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
