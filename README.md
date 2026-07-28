# Backtest Visualiser — Frontend

Dashboard for exploring and comparing trading-strategy backtest results.

## Stack

| Concern       | Choice                                     | Why                                                       |
| ------------- | ------------------------------------------ | --------------------------------------------------------- |
| Framework     | React 19 + TypeScript, Vite 8              | SPA against a separate backtest API; no SSR needed         |
| Routing       | React Router 8 (`react-router`)            | Lazy routes, URL-driven filters                            |
| Server state  | TanStack Query 5                           | Caching, retries, request dedup                            |
| Client state  | Zustand 5                                  | Theme, sidebar, comparison set                             |
| Validation    | Zod 4                                      | Parses every API response and the env vars                 |
| Styling       | Tailwind CSS 4 + shadcn/ui                 | CSS-first tokens; components live in the repo              |
| Price charts  | lightweight-charts 5                       | Purpose-built for financial time series                    |
| Stat charts   | Recharts 3                                 | Declarative panels: drawdown, distributions                |
| Testing       | Vitest 4 + Testing Library                 | Same transform pipeline as the app                         |

> `react-router-dom` is deprecated as of v7 — everything now lives in
> `react-router`. Import from that package; the DOM one is not installed.

## Getting started

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

The app runs at http://localhost:5173.

Requests to `/api/*` are proxied to `DEV_API_PROXY_TARGET` (default
`http://localhost:8000`), so the browser sees a same-origin URL and there is no
CORS setup in development. Point that variable at your backtest API.

## Scripts

| Script                  | Does                                            |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Dev server with HMR                             |
| `npm run build`         | Typecheck, then production build to `dist/`     |
| `npm run preview`       | Serve the built bundle                          |
| `npm run typecheck`     | `tsc --build`, no emit                          |
| `npm run lint`          | ESLint, zero warnings tolerated                 |
| `npm run lint:fix`      | ESLint with autofix                             |
| `npm run format`        | Prettier write                                  |
| `npm test`              | Vitest, single run                              |
| `npm run test:watch`    | Vitest, watch mode                              |
| `npm run test:coverage` | Coverage report to `coverage/`                  |
| `npm run validate`      | typecheck + lint + test — run this before a PR  |

## Architecture

See [src/README.md](src/README.md) for the folder layout, the dependency
direction rule, and how to add a feature.

## Environment variables

Only `VITE_`-prefixed variables reach the browser, and they are **inlined into
the bundle** — never put a secret in one. All of them are validated at startup
by `src/config/env.ts`, so a missing or malformed value fails immediately with a
readable message rather than surfacing later as `undefined`.

| Variable               | Default  | Purpose                                    |
| ---------------------- | -------- | ------------------------------------------ |
| `VITE_API_BASE_URL`    | `/api`   | API base; leave as `/api` to use the proxy |
| `VITE_API_TIMEOUT`     | `30000`  | Request timeout (ms)                       |
| `DEV_API_PROXY_TARGET` | —        | Build-time only; dev proxy destination     |

## Adding shadcn/ui components

```bash
npx shadcn@latest add dialog table tabs select
```

They generate into `src/components/ui/`, which ESLint ignores — the code is
vendored and yours to edit.

## Expected API

The frontend expects these endpoints (see
`src/features/backtests/types/backtest.ts` for exact payload schemas):

- `GET /backtests` → `{ items, total, page, pageSize }`
- `GET /backtests/:id` → backtest detail incl. `metrics`, `equityCurve`, `trades`
- `DELETE /backtests/:id`

Responses are validated with Zod, so a schema mismatch fails loudly and points
at the offending field.
