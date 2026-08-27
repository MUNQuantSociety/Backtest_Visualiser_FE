import type { LogEntry, SystemStatus } from './types';

/**
 * Demo data for the MQS Master system views, served when `VITE_USE_FIXTURES=true`.
 * Same stopgap caveat as the portfolios fixtures — replace with a Prism mock.
 *
 * The service list mirrors what `start.sh` actually launches, so the demo does
 * not invent a process nobody has to keep alive.
 */

export function fixtureSystemStatus(): SystemStatus {
    const now = Date.now();
    const heartbeat = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

    return {
        state: 'degraded',
        marketOpen: true,
        version: '0.9.3',
        uptimeSeconds: 19 * 3600 + 42 * 60,
        checkedAt: new Date(now).toISOString(),
        services: [
            {
                name: 'RunEngine',
                label: 'Live engine',
                state: 'up',
                detail: '5 portfolio threads alive',
                lastHeartbeatAt: heartbeat(3),
            },
            {
                name: 'oms-tick',
                label: 'OMS tick thread',
                state: 'up',
                detail: 'Tick interval 5s',
                lastHeartbeatAt: heartbeat(4),
            },
            {
                name: 'realtime-ingestor',
                label: 'Market data ingestor',
                state: 'up',
                detail: 'FMP stream, 0 gaps in last hour',
                lastHeartbeatAt: heartbeat(2),
            },
            {
                name: 'postgres',
                label: 'PostgreSQL',
                state: 'up',
                detail: '4 of 20 connections in use',
                lastHeartbeatAt: heartbeat(1),
            },
            {
                // A degraded non-trading service is exactly the case a single green dot
                // would hide, so the fixture leads with it.
                name: 'nlp-daemon',
                label: 'NLP sentiment daemon',
                state: 'degraded',
                detail: 'FinBERT queue backlog: 431 articles',
                lastHeartbeatAt: heartbeat(96),
            },
        ],
    };
}

const SAMPLE_LINES: readonly (readonly [LogEntry['level'], string, string, string | null])[] = [
    ['INFO', 'RunEngine', 'Loaded 6 portfolios from src/portfolios', null],
    ['INFO', 'VolMomentum_1', 'Registered indicator set: roc (RateOfChange, period=20)', '1'],
    ['INFO', 'tradeExecutor', 'Fill: BUY 42 NVDA @ 178.30 (parent parent-1-0)', '1'],
    ['DEBUG', 'OrderManager_1', 'TWAP slice 3/10 scheduled for 14:12:00', '1'],
    ['WARNING', 'VolMomentum_1', 'Risk-Off Mode: cash below 10% of total value', '1'],
    ['INFO', 'MeanReversion_2', 'Signal: SELL BAC (z-score 2.14 > threshold 2.0)', '2'],
    ['ERROR', 'nlp-daemon', 'FinBERT batch timed out after 30s; retrying', null],
    ['INFO', 'DailyAllocator', 'Rebalance complete; weights unchanged', null],
    ['WARNING', 'realtime-ingestor', 'No bars for NVDA at 14:05 (half day)', null],
    ['INFO', 'TrendFollowing_4', 'Fast/slow crossover on SPY: no action', '4'],
    ['DEBUG', 'MQSDBConnector', 'Query market_data returned 1,204 rows in 82ms', null],
    ['CRITICAL', 'RunEngine', 'Circuit breaker armed for portfolio 6 (0% allocation)', '6'],
];

export function fixtureLogTail(size: number): LogEntry[] {
    const now = Date.now();

    return Array.from({ length: size }, (_unused, index) => {
        const line = SAMPLE_LINES[index % SAMPLE_LINES.length];
        const [level, logger, message, portfolioId] = line ?? ['INFO', 'RunEngine', 'Idle', null];

        return {
            id: `log-${String(index)}`,
            timestamp: new Date(now - index * 17_000).toISOString(),
            level,
            logger,
            message,
            portfolioId,
        };
    });
}
