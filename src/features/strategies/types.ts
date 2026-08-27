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
