/**
 * The bar sizes a run can simulate on, from one minute to one trading day.
 *
 * Values are seconds held as strings because `Segmented` keys its options by
 * string; `barIntervalSeconds` converts at the request boundary. The backend
 * accepts exactly these values and refuses anything else, so this list and
 * `BAR_SECONDS_CHOICES` in the engine have to move together.
 */
export const BAR_INTERVAL_VALUES = ['60', '300', '900', '1800', '3600', '86400'] as const;
export type BarInterval = (typeof BAR_INTERVAL_VALUES)[number];

export const BAR_INTERVALS: readonly { value: BarInterval; label: string }[] = [
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '900', label: '15m' },
  { value: '1800', label: '30m' },
  { value: '3600', label: '1h' },
  { value: '86400', label: '1D' },
];

/** Daily bars: what every run used before the choice existed. */
export const DEFAULT_BAR_INTERVAL: BarInterval = '86400';

/** The value the backend reads as `params.barIntervalSeconds`. */
export function barIntervalSeconds(interval: BarInterval): number {
  return Number(interval);
}

/** True for any bar shorter than a trading day. */
export function isIntradayBar(interval: BarInterval): boolean {
  return interval !== DEFAULT_BAR_INTERVAL;
}
