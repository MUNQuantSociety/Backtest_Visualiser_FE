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

/** Largest source file accepted, in bytes. A strategy is not a dataset. */
export const MAX_SOURCE_BYTES = 256 * 1024;

/**
 * New strategy source, however the author supplied it.
 *
 * `source` is text in both cases — the upload path reads the file in the
 * browser so the author can read it back before submitting. `filename` records
 * where it came from, which matters when someone uploads the wrong file and
 * needs to be told which one.
 */
export const strategySubmissionSchema = z.object({
  name: z.string().trim().min(1, 'Give the strategy a name.').max(80),
  description: z.string().trim().max(500).default(''),
  source: z
    .string()
    .min(1, 'Add some code, or upload a file.')
    .refine(
      (value) => new Blob([value]).size <= MAX_SOURCE_BYTES,
      'That file is too large — strategies are capped at 256 KB.',
    ),
  /** Null when typed directly into the editor. */
  filename: z.string().nullable().default(null),
});
export type StrategySubmission = z.infer<typeof strategySubmissionSchema>;

/**
 * One reason a file would not run here, tied to the line that causes it.
 *
 * `line` is 0 when the problem is the file as a whole (no strategy class in
 * it, for instance), which the editor renders without a line number.
 */
export const compatibilityIssueSchema = z.object({
  line: z.number().int(),
  message: z.string(),
});
export type CompatibilityIssue = z.infer<typeof compatibilityIssueSchema>;

/**
 * The verdict on a piece of source.
 *
 * `unchecked` never comes off the wire: the backend answers `compatible` or
 * `incompatible` and nothing else. It is produced client-side in fixture mode,
 * where there is no backend to ask, so the UI can say "nothing was checked"
 * instead of implying a pass.
 */
export const compatibilityStatusSchema = z.enum(['compatible', 'incompatible', 'unchecked']);
export type CompatibilityStatus = z.infer<typeof compatibilityStatusSchema>;

/**
 * Starter source for the editor.
 *
 * Fetched rather than kept in the client. The contract it teaches (which base
 * class, what the engine calls, where the tickers come from) belongs to the
 * engine, and a copy here drifts from it. The previous copy did exactly that:
 * it was written against a base class that never existed.
 */
export const strategyTemplateSchema = z.object({
  filename: z.string(),
  source: z.string().min(1),
});
export type StrategyTemplate = z.infer<typeof strategyTemplateSchema>;

/** What the source needs to be checked, and nothing that identifies it yet. */
export const strategyCheckRequestSchema = z.object({
  source: z.string().min(1, 'Add some code, or upload a file.'),
  filename: z.string().nullable().default(null),
});
export type StrategyCheckRequest = z.infer<typeof strategyCheckRequestSchema>;

/**
 * The answer to "would this run here?".
 *
 * Incompatible source still arrives as HTTP 200: the check ran and its answer
 * is no. `ok` and `issues` carry the verdict; a status code could only carry
 * one problem, and the point of the check is to report all of them at once.
 */
export const strategyCheckResultSchema = z.object({
  status: compatibilityStatusSchema,
  ok: z.boolean(),
  className: z.string().nullable().default(null),
  issues: z.array(compatibilityIssueSchema).default([]),
  /** Reported, never disqualifying: `ok` can be true with warnings present. */
  warnings: z.array(compatibilityIssueSchema).default([]),
  message: z.string().default(''),
});
export type StrategyCheckResult = z.infer<typeof strategyCheckResultSchema>;

export const strategySubmissionResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: strategyStatusSchema,
  message: z.string().default(''),
});
export type StrategySubmissionResult = z.infer<typeof strategySubmissionResultSchema>;

export interface StrategyFilters {
  search?: string;
  status?: StrategyStatus;
}
