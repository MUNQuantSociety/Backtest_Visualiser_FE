/**
 * Custom per-ticker weights for one run, as the run form edits them.
 *
 * The form holds percentages as typed strings, keyed by ticker, so a half-typed
 * "33." survives a re-render. The backend takes fractions under the reserved
 * `weights` parameter and applies the same rules: every weight 0–100%, the
 * total at most 100% (the rest stays in cash; nothing models leverage), and
 * something allocated. Checking here first turns a 422 into a message by the
 * field.
 */

/** `default` sends no weights, keeping the backend's choice; `custom` sends these. */
export type WeightMode = 'default' | 'custom';

export type WeightPercents = Readonly<Record<string, string>>;

export type ParsedWeights =
  { ok: true; weights: Record<string, number> } | { ok: false; message: string };

/** Rounding room for weights typed to two decimals: 33.33 + 33.33 + 33.34. */
const TOTAL_TOLERANCE_PERCENT = 1e-4;
const FULL_BOOK_PERCENT = 100;
/** Hundredths of a percent: the precision an equal split is written in. */
const SPLIT_STEPS = 100 * FULL_BOOK_PERCENT;

/**
 * An equal split, written to two decimals, with the rounding remainder on the
 * last ticker so the whole adds up to exactly 100%.
 */
export function equalWeightPercents(universe: readonly string[]): Record<string, string> {
  if (universe.length === 0) return {};
  const share = Math.floor(SPLIT_STEPS / universe.length);
  const remainder = SPLIT_STEPS - share * universe.length;
  return Object.fromEntries(
    universe.map((ticker, index) => {
      const steps = index === universe.length - 1 ? share + remainder : share;
      return [ticker, String(steps / 100)];
    }),
  );
}

/** Blank counts as 0; anything else that is not a number is NaN. */
function percentOf(values: WeightPercents, ticker: string): number {
  const raw = (values[ticker] ?? '').trim();
  return raw === '' ? 0 : Number(raw);
}

/** The total of the universe's weights, in percent; NaN if any is not a number. */
export function weightTotalPercent(values: WeightPercents, universe: readonly string[]): number {
  return universe.reduce((sum, ticker) => sum + percentOf(values, ticker), 0);
}

/** Fractions for the backend, or the first reason they would be refused. */
export function parseWeightPercents(
  values: WeightPercents,
  universe: readonly string[],
): ParsedWeights {
  const weights: Record<string, number> = {};
  for (const ticker of universe) {
    const percent = percentOf(values, ticker);
    if (!Number.isFinite(percent)) {
      return { ok: false, message: `${ticker} weight must be a number.` };
    }
    if (percent < 0 || percent > FULL_BOOK_PERCENT) {
      return { ok: false, message: `${ticker} weight must be between 0% and 100%.` };
    }
    weights[ticker] = percent / FULL_BOOK_PERCENT;
  }
  const total = weightTotalPercent(values, universe);
  if (total <= 0) {
    return { ok: false, message: 'Give at least one ticker a weight above 0%.' };
  }
  if (total > FULL_BOOK_PERCENT + TOTAL_TOLERANCE_PERCENT) {
    return {
      ok: false,
      message: `Weights add up to ${String(Math.round(total * 100) / 100)}%; they can add up to 100% at most.`,
    };
  }
  return { ok: true, weights };
}
