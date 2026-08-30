/**
 * The demo dataset is deliberately typed `unknown` rather than let TypeScript
 * infer it.
 *
 * With `resolveJsonModule` TypeScript would build a literal type covering every
 * one of the ~1,400 curve points and ~1,250 trades in the file, which makes each
 * `tsc` run dramatically slower for no benefit — the shape is already described
 * by the Zod schemas in `src/features/backtests/types.ts`, and those parse it at
 * load, so a dataset that drifts from the contract fails loudly with a real
 * message instead of silently type-checking.
 */
declare module '@data/backtests.json' {
  const dataset: unknown;
  export default dataset;
}
