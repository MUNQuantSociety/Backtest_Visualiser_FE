import { useQuery } from '@tanstack/react-query';

import { LIVE_REFETCH_MS, LOG_TAIL_SIZE } from '@/config/constants';
import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import { fixtureLogTail, fixtureSystemStatus } from './fixtures';
import {
    logTailResponseSchema,
    systemStatusSchema,
    type LogTail,
    type SystemStatus,
} from './types';

/**
 * Transport layer for system health and the log tail. Fixtures are swapped in
 * here and nowhere else, exactly as in the portfolios feature.
 */

const FIXTURE_DELAY_MS = 180;

async function withFixtureDelay<T>(value: T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
    return value;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
    if (env.useFixtures) {
        return withFixtureDelay(systemStatusSchema.parse(fixtureSystemStatus()));
    }

    const data = await apiClient.get<unknown>('/live/system/status');
    return systemStatusSchema.parse(data);
}

export async function fetchLogTail(size: number): Promise<LogTail> {
    if (env.useFixtures) {
        return withFixtureDelay(
            logTailResponseSchema.parse({ entries: fixtureLogTail(size), truncated: true }),
        );
    }

    const data = await apiClient.get<unknown>('/live/system/logs', { params: { size } });
    return logTailResponseSchema.parse(data);
}

export function useSystemStatus() {
    return useQuery({
        queryKey: systemKeys.status(),
        queryFn: fetchSystemStatus,
        refetchInterval: LIVE_REFETCH_MS,
        refetchIntervalInBackground: false,
    });
}

export function useLogTail(size: number = LOG_TAIL_SIZE) {
    return useQuery({
        queryKey: systemKeys.logs(size),
        queryFn: () => fetchLogTail(size),
        // Logs move faster than portfolio valuations and are what someone watches
        // during an incident, so this polls harder than the rest of the live views.
        refetchInterval: 5_000,
        refetchIntervalInBackground: false,
        placeholderData: (previous) => previous,
    });
}

/** Hierarchical query keys for the system feature. */
export const systemKeys = {
    all: ['system'] as const,
    status: () => [...systemKeys.all, 'status'] as const,
    logs: (size: number) => [...systemKeys.all, 'logs', size] as const,
} as const;
