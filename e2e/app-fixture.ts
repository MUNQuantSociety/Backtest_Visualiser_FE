import { test as base, expect } from '@playwright/test';
import { loadEnv } from 'vite';

const config = { ...loadEnv('production', process.cwd()), ...process.env };
const authority = config.VITE_AUTH_AUTHORITY?.replace(/\/$/, '');
const clientId = config.VITE_AUTH_CLIENT_ID;
const origin = 'http://127.0.0.1:4179';
const api = new URL(config.VITE_API_BASE_URL || '/api', origin);

const curve = Array.from({ length: 180 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
  equity: 100_000 + index * 90 + Math.sin(index / 5) * 400,
  benchmark: 100_000 + index * 30,
}));

export const runs = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name, index) => ({
  id: `run-${index + 1}`,
  name: `${name} run`,
  strategyId: index < 2 ? 'momentum' : 'reversion',
  strategyName: index < 2 ? 'Momentum' : 'Reversion',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'completed',
  startDate: curve[0].date,
  endDate: curve.at(-1)!.date,
  createdAt: `2025-07-0${index + 1}T00:00:00Z`,
  initialCapital: 100_000,
  finalEquity: 116_000 - index * 1_000,
  totalReturn: 0.16 - index * 0.01,
  sharpe: 1.5,
  maxDrawdown: -0.03,
  metrics: {
    totalReturn: 0.16 - index * 0.01,
    cagr: 0.2,
    sharpe: 1.5,
    sortino: 2,
    maxDrawdown: -0.03,
    volatility: 0.1,
    winRate: 0.6,
    profitFactor: 2,
    totalTrades: 6,
  },
  equityCurve: curve.map((point) => ({ ...point, equity: point.equity - index * 2 })),
  trades: Array.from({ length: 6 }, (_, trade) => ({
    id: `trade-${trade}`,
    symbol: 'AAPL',
    side: 'long',
    entryDate: curve[trade * 20].date,
    exitDate: curve[trade * 20 + 10].date,
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    pnl: 100,
    returnPct: 0.1,
    fees: 0,
  })),
  parameters: { universe: ['AAPL'], period: 10 + index },
}));

const strategies = ['Momentum', 'Reversion'].map((name) => ({
  id: name.toLowerCase(),
  name,
  className: name,
  description: `${name} test strategy`,
  status: 'active',
  origin: 'builtin',
  universe: ['AAPL'],
  tags: [],
  parameters: [],
  indicators: ['RateOfChange'],
  runCount: 2,
  bestSharpe: 1.5,
  bestReturn: 0.16,
  lastRunAt: '2025-07-04T00:00:00Z',
}));

interface ApiState {
  failures: Map<string, number>;
  empty: boolean;
  writes: { method: string; path: string; body: unknown }[];
}

export const test = base.extend<{ apiState: ApiState }>({
  apiState: [
    async ({ page }, use) => {
      if (!authority || !clientId || config.VITE_USE_FIXTURES !== 'false') {
        throw new Error('Browser checks require public OIDC config and VITE_USE_FIXTURES=false.');
      }
      const state: ApiState = { failures: new Map(), empty: false, writes: [] };
      const unexpected: string[] = [];
      const runtimeErrors: string[] = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('console', (message) => {
        // Expected HTTP failure cases are asserted by their test. React boundary
        // errors still fail here even when React catches the exception itself.
        if (
          message.type() === 'error' &&
          /React error|Maximum update|ErrorBoundary|TypeError|ReferenceError/i.test(message.text())
        ) {
          runtimeErrors.push(message.text());
        }
      });
      // Synthetic OIDC user, scoped to this isolated test context. Every API
      // request is intercepted below; this token never reaches a real service.
      await page.addInitScript(
        ({ key }) => {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              access_token: 'isolated-browser-test-token',
              token_type: 'Bearer',
              scope: 'openid email profile',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              profile: {
                sub: 'browser-test',
                iss: 'test',
                aud: 'test',
                exp: 4_000_000_000,
                iat: 1,
              },
            }),
          );
        },
        { key: `oidc.user:${authority}:${clientId}` },
      );

      await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const isApi =
          url.origin === api.origin &&
          url.pathname.startsWith(`${api.pathname.replace(/\/$/, '')}/`);
        if (!isApi) {
          if (
            url.origin === 'https://fonts.googleapis.com' &&
            request.resourceType() === 'stylesheet'
          ) {
            await route.fulfill({ contentType: 'text/css', body: '' });
            return;
          }
          if (url.origin === origin && !['xhr', 'fetch'].includes(request.resourceType())) {
            await route.continue();
          } else {
            unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
            await route.abort('blockedbyclient');
          }
          return;
        }
        const path = url.pathname.slice(api.pathname.replace(/\/$/, '').length);
        const method = request.method();
        const status = state.failures.get(path);
        if (status) {
          await route.fulfill({
            status,
            json: { message: 'Test service unavailable', code: `HTTP_${status}` },
          });
          return;
        }
        let body: unknown;
        const items = state.empty ? [] : runs;
        const run = runs.find((item) => item.id === path.split('/')[2]);
        if (method !== 'GET')
          state.writes.push({ method, path, body: request.postDataJSON() as unknown });
        if (path === '/auth/me')
          body = {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'test@example.test',
            displayName: 'Browser test',
          };
        else if (path === '/backtests/active') body = [];
        else if (path === '/backtests' && method === 'POST') body = runs[0];
        else if (path === '/backtests')
          body = { items, total: items.length, page: 1, pageSize: 100 };
        else if (path === '/strategies')
          body = {
            items: state.empty ? [] : strategies,
            total: state.empty ? 0 : strategies.length,
          };
        else if (path === '/strategies/indicators')
          body = { items: [{ name: 'RateOfChange', parameters: [] }], total: 1 };
        else if (path === '/market-data/coverage')
          body = {
            tickers: [{ ticker: 'AAPL', firstBar: curve[0].date, lastBar: curve.at(-1)!.date }],
            start: curve[0].date,
            end: curve.at(-1)!.date,
            missing: [],
          };
        else if (path === '/market-data/validate-tickers')
          body = {
            tickers: (url.searchParams.get('tickers') || '')
              .split(',')
              .map((ticker) => ({ ticker, status: 'valid' })),
            unknown: [],
          };
        else if (path === '/market-data/search-symbols')
          body = {
            matches: [
              { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', source: 'database' },
            ],
            truncated: false,
            providerError: null,
          };
        else if (path === '/market-data/closes')
          body = {
            ticker: 'SPY',
            points: curve.map((point) => ({ date: point.date, close: point.benchmark })),
          };
        else if (path === '/indicators')
          body = {
            items: [
              {
                ticker: 'AAPL',
                last: 120,
                change1d: 0.01,
                rsi14: 55,
                macdHistogram: 0.5,
                smaRegime: 'above',
                momentum20d: 0.03,
                sentiment7d: 0.2,
                sentimentDelta7d: 0.1,
                asOf: curve.at(-1)!.date,
              },
            ],
          };
        else if (path === '/news')
          body = {
            items: [
              {
                id: 'story-1',
                source: 'Test publisher',
                publishedAt: curve.at(-1)!.date,
                headline: 'Test market story',
                summary: 'A test news summary.',
                tickers: ['AAPL'],
                score: 0.2,
              },
            ],
          };
        else if (path === '/news/story-1/story')
          body = {
            id: 'story-1',
            title: 'Test market story',
            summary: 'A test news summary.',
            origin: 'stored',
          };
        else if (run && path.endsWith('/equity'))
          body = {
            ...run,
            window: {
              period: url.searchParams.get('period') || '1y',
              requestedStart: run.startDate,
              requestedEnd: run.endDate,
              availableStart: run.startDate,
              availableEnd: run.endDate,
            },
          };
        else if (run && path.includes('/exports/')) {
          await route.fulfill({
            contentType: 'text/csv',
            body: 'date,equity\n2025-01-01,100000\n',
          });
          return;
        } else if (run && method === 'DELETE') {
          await route.fulfill({ status: 204 });
          return;
        } else if (run) body = run;
        else {
          unexpected.push(`${method} ${path}`);
          await route.fulfill({ status: 501, json: { message: 'Unmocked test request' } });
          return;
        }
        await route.fulfill({ json: body });
      });
      await use(state);
      expect(unexpected, 'No unexpected or external requests').toEqual([]);
      expect(runtimeErrors, 'No browser runtime errors').toEqual([]);
      await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    },
    { auto: true },
  ],
});

export { expect };
