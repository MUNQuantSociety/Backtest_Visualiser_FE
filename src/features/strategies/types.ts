import { z } from 'zod';

/**
 * A strategy is the thing you test; a backtest is one test of it.
 *
 * Until now a strategy existed only as `strategyId`/`strategyName` denormalised
 * onto every backtest row, which is enough to label a chart and not enough to
 * build a page around. This schema gives it an identity of its own: the code
 * that implements it, the parameters it accepts, and how its runs have gone.
 */

export const strategyStatusSchema = z.enum(['active', 'draft', 'archived']);
export type StrategyStatus = z.infer<typeof strategyStatusSchema>;

/**
 * One tunable input, described well enough to render a form control without the
 * UI hardcoding a field list per strategy.
 */
export const parameterSpecSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['number', 'integer', 'percent', 'boolean']),
  default: z.union([z.number(), z.boolean()]),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type ParameterSpec = z.infer<typeof parameterSpecSchema>;

export const strategySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The `OnData` class the engine instantiates, e.g. "VolMomentum". */
  className: z.string(),
  description: z.string(),
  status: strategyStatusSchema,
  tags: z.array(z.string()).default([]),
  parameters: z.array(parameterSpecSchema).default([]),
  /** Symbols the strategy is written for; the run form defaults to these. */
  universe: z.array(z.string()).default([]),

  /*
   * Aggregates over this strategy's backtests. Denormalised onto the row on
   * purpose: the catalogue would otherwise need one request per strategy to
   * render a single card, and the backend can compute these far more cheaply
   * than the client can by fetching every run.
   */
  runCount: z.number().int().nonnegative(),
  bestSharpe: z.number().nullable(),
  bestReturn: z.number().nullable(),
  lastRunAt: z.string().nullable(),
});
export type Strategy = z.infer<typeof strategySchema>;

export const strategyListResponseSchema = z.object({
  items: z.array(strategySchema),
  total: z.number().int(),
});

/*
 * Launching a run lives in `features/backtests`, not here: the endpoint is
 * `POST /backtests` and the thing it creates is a backtest. Strategies supply
 * the defaults for that form and nothing more.
 */

export interface StrategyFilters {
  search?: string;
  status?: StrategyStatus;
}
