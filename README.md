# MQS Frontend

One React app hosting two products:

| Product                 | Lives at | Shows                                                                     |
| ----------------------- | -------- | ------------------------------------------------------------------------  |
| **Backtest Visualiser** | `/`      | Exploring and comparing trading-strategy backtest results — **simulated** |
| **MQS Master**          | `/live`  | The live trading system's portfolios, health and log — **real money**     |

They share a shell, a design system, a charting stack and one auth path. They do
**not** share a URL space: the `/live` prefix exists so that a glance at the
address bar says whether a drawdown chart came from a simulation or from real
fills. The sidebar is grouped by product for the same reason.

## Stack

| Concern      | Choice                          | Why                                           |
| ------------ | ------------------------------- | --------------------------------------------- |
| Framework    | React 19 + TypeScript, Vite 8   | SPA against a separate API; no SSR needed     |
| Routing      | React Router 8 (`react-router`) | Lazy routes, URL-driven filters               |
| Server state | TanStack Query 5                | Caching, retries, request dedup, polling      |
| Client state | Zustand 5                       | Theme, sidebar, comparison set                |
| Validation   | Zod 4                           | Parses every API response and the env vars    |
| Styling      | Tailwind CSS 4 + shadcn/ui      | CSS-first tokens; components live in the repo |
| Price charts | lightweight-charts 5            | Purpose-built for financial time series       |
| Stat charts  | Recharts 3                      | Declarative panels: drawdown, distributions   |
| Testing      | Vitest 4 + Testing Library      | Same transform pipeline as the app            |

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
CORS setup in development. Point that variable at your API.

**No backend yet?** Nothing to configure — with nothing listening on that port,
backtest views fall back to the committed dataset at `mock-data/backtests.json`
and every chart still renders. Set `VITE_USE_FIXTURES=true` to force demo data
for the `/live` views too. See [Demo data and fixtures](#demo-data-and-fixtures)
— a stopgap, not the plan.

## Routes

| Path                        | Page                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `/`                         | Backtest dashboard                                               |
| `/backtests`                | All runs, filters in the URL                                     |
| `/backtests/:backtestId`    | Run detail — performance vs. benchmark, drawdown, tearsheet      |
| `/live`                     | MQS Master overview — balance, P&L, server status                |
| `/live/portfolios`          | Every sleeve the live engine runs                                |
| `/live/portfolios/:id`      | Summary, equity, drawdowns, risk, positions, correlations, fills |
| `/live/log`                 | Tail of the engine's Python log, filtered by level               |
| `/live/settings`            | Theme and build info                                             |

Build links through `paths` in `src/app/router/paths.ts` — never a string
literal — so a route rename is one edit.

## Scripts

| Script                  | Does                                           |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Dev server with HMR                            |
| `npm run build`         | Typecheck, then production build to `dist/`    |
| `npm run preview`       | Serve the built bundle                         |
| `npm run generate:mock-data` | Regenerate `mock-data/backtests.json`     |
| `npm run typecheck`     | `tsc --build`, no emit                         |
| `npm run lint`          | ESLint, zero warnings tolerated                |
| `npm run lint:fix`      | ESLint with autofix                            |
| `npm run format`        | Prettier write                                 |
| `npm test`              | Vitest, single run                             |
| `npm run test:watch`    | Vitest, watch mode                             |
| `npm run test:coverage` | Coverage report to `coverage/`                 |
| `npm run validate`      | typecheck + lint + test — run this before a PR |

## Architecture

See [src/README.md](src/README.md) for the folder layout, the dependency
direction rule, and how to add a feature.

Four feature slices, each with a public barrel that is the only legal import
path into it:

| Feature                | Owns                                                    |
| ---------------------- | ------------------------------------------------------- |
| `features/backtests`   | Backtest runs, their metrics and round-trip trades      |
| `features/performance` | Equity/drawdown charts, metrics grid, tearsheet table   |
| `features/portfolios`  | Live portfolios, positions, fills, correlations, config |
| `features/system`      | Engine health per service, and the log tail             |

`features/performance` is shared: the live portfolio page renders its
`EquityCurveChart` and `DrawdownChart` unchanged. Theme-reactive palettes and
canvas token resolution are solved once, not per product.

## Charting

Two libraries, split by what the x-axis means. **Do not add a third.**

| Library              | Use for                                                     |
| -------------------- | ----------------------------------------------------------- |
| `lightweight-charts` | Anything on a time axis: equity, drawdown, price            |
| `recharts`           | Categorical and derived views: histograms, distributions    |

`lightweight-charts` is canvas, handles very large series, and is the only one
of the two with multi-pane support and series markers. `recharts` is SVG and
declarative, which is far better for a binned chart with a custom tooltip and
far worse past a few thousand points. Chart.js was considered and rejected: it
adds a third dependency without covering either case better than the incumbent.

**The equity chart is one component, not several.** `EquityCurveChart` takes
optional `trades` (entry markers) and `showDrawdownPane` (a second pane sharing
the time axis). The backtest detail page passes both; the live portfolio page
passes neither and gets the plain curve. If you find yourself writing a second
equity chart, stop — that is the reason both products live in one app.

### The `oklch()` trap

Tailwind 4 emits design tokens as `oklch(...)`, and `lightweight-charts` ships
its own colour parser that predates CSS Color 4. Handing it a token verbatim
throws `Failed to parse color` and the chart never mounts — silently, because
the `ChartContainer` error boundary swallows it and you just get a blank panel.

Browsers will not convert for you either: Chrome serialises both
`getComputedStyle(el).color` and `ctx.fillStyle` straight back as `oklch(...)`.
So `src/lib/chart-theme.ts` paints each token to a 1×1 canvas and reads the
pixel back, which forces a real sRGB conversion.

Consequences for anyone touching chart colour:

- Always go through `resolveToken()` / `useChartPalette()`. Never read a CSS
  custom property into a canvas chart yourself.
- `color-mix()` is unparseable for the same reason. Use `withAlpha()`.
- This applies to `lightweight-charts` only. Recharts hands colours to SVG,
  where the browser parses them natively — which is why the drawdown chart kept
  working while the equity curve was broken.

### Two things that look like duplication and are not

- **`Trade` vs `Execution`.** A backtest `Trade` is a round trip with an entry
  and an exit. A live `Execution` is one fill leg from `trade_execution_logs` —
  the engine logs fills as they happen and has no idea whether the position will
  ever be closed. Merging them would force a lowest-common-denominator schema on
  both.
- **Config key casing.** Transport is camelCase everywhere, but the `config`
  object inside a portfolio payload keeps MQSMaster's `SCREAMING_SNAKE` keys
  verbatim, because `BasePortfolio` reads `TICKERS` and `LOOKBACK_DAYS` by name.
  Renaming in transit would need a mapping table on both sides, and it would
  drift the first time someone adds a key.

## Environment variables

Only `VITE_`-prefixed variables reach the browser, and they are **inlined into
the bundle** — never put a secret in one. All of them are validated at startup
by `src/config/env.ts`, so a missing or malformed value fails immediately with a
readable message rather than surfacing later as `undefined`.

| Variable               | Default | Purpose                                    |
| ---------------------- | ------- | ------------------------------------------ |
| `VITE_API_BASE_URL`    | `/api`  | API base; leave as `/api` to use the proxy |
| `VITE_API_TIMEOUT`     | `30000` | Request timeout (ms)                       |
| `VITE_USE_FIXTURES`    | `false` | Serve demo data instead of calling the API |
| `DEV_API_PROXY_TARGET` | —       | Build-time only; dev proxy destination     |

`VITE_USE_FIXTURES` must be exactly `"true"` or `"false"`. It is not coerced
with `z.coerce.boolean()`, which treats every non-empty string as true and would
make `VITE_USE_FIXTURES=false` silently mean *true*.

## Demo data and fixtures

Backtests read from **`mock-data/backtests.json`**, a dataset committed at the
repo root — 6 runs, ~1,400 equity-curve points, ~1,250 trades. Every chart
renders from it, so a fresh clone is fully functional with no backend running.

It is served in two situations:

- **The backend is unreachable.** In dev only, a request that reaches no server
  (status 0) or gets a gateway answer (502/503/504 — what the Vite proxy returns
  when nothing is listening on `DEV_API_PROXY_TARGET`) falls back to the dataset
  and logs a warning naming the file. A 4xx or a 5xx from a backend that *is*
  running still surfaces as an error: quietly swapping in demo data would hide a
  real bug behind plausible numbers. Production never falls back.
- **`VITE_USE_FIXTURES=true`.** Forces demo data regardless of the backend.

To change the data, edit the blueprints in
`src/features/backtests/mock-source.ts` and regenerate:

```bash
npm run generate:mock-data
```

The generator runs through `vite-node`, so it resolves the same `@/` aliases as
the app and shares `@/utils/metrics` rather than reimplementing it. Output is
committed on purpose — a clone should render charts with no build step. It loads
through a dynamic import pinned to its own bundle chunk, so the ~570 KB never
reaches anyone who does not hit one of the two paths above.

With `VITE_USE_FIXTURES=true`, **both** products render demo data
shaped like the real payloads — including the actual portfolio IDs, ticker sets
and strategy class names from MQSMaster, so nobody learns a layout that does not
exist. Settings shows a **"Fixtures — not live data"** badge whenever it is on.

The backtest dataset derives its numbers rather than inventing them: metrics
run through `@/utils/metrics` over the generated equity curve, and trade P&L is
scaled so it reconciles exactly with the curve's net profit. A tearsheet whose
Sharpe disagrees with its own equity chart is worse than no tearsheet. The set
also includes a losing strategy on purpose — a demo where everything wins is the
one thing a quant reader will not believe.

The swap happens in each feature's `api/` module and nowhere else. Components,
hooks and query keys are byte-identical in both modes, which is what makes
deleting the fixture path a one-line change.

**This is a stopgap.** The real answer is a mock server generated from the
OpenAPI spec (e.g. `prism mock openapi.yaml --port 8000`), so the demo exercises
the same wire format the backend will serve. Point `DEV_API_PROXY_TARGET` at it
and set `VITE_USE_FIXTURES=false`.

## Adding shadcn/ui components

```bash
npx shadcn@latest add dialog table tabs select
```

They generate into `src/components/ui/`, which ESLint ignores — the code is
vendored and yours to edit.

## Expected API

Every response is validated with Zod, so a schema mismatch fails loudly and
points at the offending field. Exact payload shapes live in each feature's
`types/` module.

**Backtests** — see `src/features/backtests/types/backtest.ts`:

- `GET /backtests` → `{ items, total, page, pageSize }`
- `GET /backtests/:id` → detail incl. `metrics`, `equityCurve`, `trades`
- `DELETE /backtests/:id`

**MQS Master** — see `src/features/portfolios/types/portfolio.ts` and
`src/features/system/types/system.ts`:

- `GET /live/portfolios` → `{ items, total, page, pageSize }`
- `GET /live/portfolios/:id` → detail incl. `config`, `positions`
- `GET /live/portfolios/:id/equity?days=` → `{ points, downsampled }`
- `GET /live/portfolios/:id/executions?page=&pageSize=` → paginated fills
- `GET /live/portfolios/:id/correlations` → `{ tickers, matrix, lookbackDays }`
- `GET /live/system/status` → per-service health
- `GET /live/system/logs?size=` → `{ entries, truncated }`

These are read-only by design. Nothing in this app writes to the live trading
system: portfolio config is displayed but never edited here, because MQSMaster
loads it by file location and places real orders from it. Changing a config is a
pull request against the trading repo, with review.

## Conventions worth knowing before your first PR

- **Colour comes from tokens.** `var(--profit)`, `var(--loss)`, `var(--warning)`
  — never a raw hex, and never a `--chart-N` series slot for a semantic meaning.
  Both chart libraries resolve the same tokens, which is what keeps them in sync
  across themes.
- **Server state → React Query. Client state → Zustand.** Never mirror fetched
  data into a store.
- **Optional props are typed `?: T | undefined`** — required by
  `exactOptionalPropertyTypes`.
- **Import features through their barrel.** `@/features/portfolios`, never
  `@/features/portfolios/portfolios-api`. ESLint enforces it.
- **Mock at the `apiClient` boundary in component tests**, not at the feature's
  fetch function. Each `<feature>-api.ts` exports the transport *and* the React
  Query hooks, and replacing a module's export does not rebind that module's own
  internal references — so `vi.mock` on `fetchBacktests` leaves `useBacktests`
  calling the real one. Mocking `apiClient` sidesteps that and keeps the Zod
  parse in the tested path.
- **Pin `env.useFixtures` to `false` in tests.** Vitest loads Vite's env, so a
  developer's `.env.local` with `VITE_USE_FIXTURES=true` would otherwise make
  the transport short-circuit to demo data and never issue the request the test
  is asserting on. Test outcomes must not depend on an untracked file.
