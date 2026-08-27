import { z } from 'zod';

import { LOG_LEVELS } from '@/config/constants';

/**
 * The API contract for MQS Master's system health and log tail.
 *
 * This is the "Server Status" section of the SvelteKit prototype, expanded into
 * something actionable: a single green dot cannot tell you that the NLP daemon
 * died while the trading engine kept running, and that distinction is the whole
 * reason anyone opens this page.
 */

export const serviceStateSchema = z.enum(['up', 'degraded', 'down']);
export type ServiceState = z.infer<typeof serviceStateSchema>;

export const serviceSchema = z.object({
    /** Process or subsystem name, e.g. "RunEngine", "nlp-daemon". */
    name: z.string(),
    label: z.string(),
    state: serviceStateSchema,
    detail: z.string().nullable().default(null),
    lastHeartbeatAt: z.string().nullable().default(null),
});
export type Service = z.infer<typeof serviceSchema>;

export const systemStatusSchema = z.object({
    /** Worst state across all services — the headline the page leads with. */
    state: serviceStateSchema,
    /**
     * `start.sh` checks market hours via FMP before launching the stack, so
     * "everything down" outside market hours is expected, not an incident.
     */
    marketOpen: z.boolean(),
    services: z.array(serviceSchema),
    version: z.string(),
    uptimeSeconds: z.number().nonnegative(),
    checkedAt: z.string(),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;

export const logLevelSchema = z.enum(LOG_LEVELS);

export const logEntrySchema = z.object({
    id: z.string(),
    timestamp: z.string(),
    level: logLevelSchema,
    /** Python logger name, e.g. "VolMomentum_1". */
    logger: z.string(),
    message: z.string(),
    portfolioId: z.string().nullable().default(null),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const logTailResponseSchema = z.object({
    entries: z.array(logEntrySchema),
    /** True when older entries exist beyond the tail window. */
    truncated: z.boolean().default(false),
});
export type LogTail = z.infer<typeof logTailResponseSchema>;
