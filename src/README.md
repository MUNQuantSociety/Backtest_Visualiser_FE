# Source layout

Feature-sliced architecture. The rule that matters: **dependencies point in one
direction only.**

```
app  ─────►  pages  ─────►  features  ─────►  components / hooks / lib / utils / config
```

Nothing on the right may import from the left. A `util` never imports a
`feature`; a `feature` never imports a `page`.

## Directories

| Path          | Holds                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `app/`        | Application wiring: providers, router, layouts. Composed once, at boot.   |
| `pages/`      | One component per route. Thin — layout and route params only.             |
| `features/`   | Self-contained domain modules. Where nearly all real code lives.          |
| `components/` | Shared presentational components. Domain-agnostic by definition.          |
| `hooks/`      | Shared hooks used by more than one feature.                               |
| `lib/`        | Third-party integration points: axios, query client, chart theming, `cn`. |
| `config/`     | Validated env vars and app-wide constants.                                |
| `types/`      | Types shared across features. Feature-specific types stay in the feature. |
| `utils/`      | Pure functions. No React, no imports from features.                       |
| `test/`       | Test setup and `renderWithProviders`.                                     |

## The four features

| Feature       | Product             | Owns                                                    |
| ------------- | ------------------- | ------------------------------------------------------- |
| `backtests`   | Backtest Visualiser | Runs, metrics, round-trip trades                        |
| `performance` | both                | Equity/drawdown charts, metrics grid, tearsheet table   |
| `portfolios`  | MQS Master          | Live sleeves, positions, fills, correlations, config    |
| `system`      | MQS Master          | Per-service engine health, log tail                     |

`performance` is the shared one, and it is shared *on purpose*: the live
portfolio page renders its charts unchanged. If you find yourself writing a
second equity chart, stop — the reason both products live in one app is so that
never happens. `EquityCurveChart` grows props (`trades`, `showDrawdownPane`)
rather than sprouting variants.

Its non-component modules are pure and testable on their own: `tearsheet.ts`
returns plain rows so the numbers can be asserted without rendering a table, and
so a CSV export later would not have to scrape JSX.

Cross-feature imports go through the barrel (`@/features/backtests`), which is
how `performance` reaches `EquityPoint` today.

## Anatomy of a feature

```
{feature}/
├── {feature}-api.ts   # transport + query keys + React Query bindings
├── card.tsx           # 
├── components/        # UI specific to this domain
├── {feature}-page.tsx # Feature's page
└── types.ts           # Zod schemas; types inferred from them
```

### The barrel rule

Other features and pages import from `@/features/backtests` — never
`@/features/backtests/backtests-api`. ESLint's `no-restricted-imports` blocks
the aliased deep path.

Inside a feature, use relative imports (`./query-keys`). Outside, use the `@/`
alias. That contrast makes a boundary violation visible while reading.

**The rule has one gap, and it has already been hit once.** The pattern matches
the aliased deep import, not a single-level relative one — so from `src/pages/`,
`../features/performance/equity-curve-chart` slips straight through. It happened
when a refactor deleted the `performance` barrel and every page started reaching
into the feature directly. If you delete a barrel, ESLint will not stop the
callers from routing around it. Every feature keeps an `index.ts`.

## Adding a feature

1. `mkdir -p src/features/<name>/components`
2. Define Zod schemas in `types.ts` and infer the TS types from them.
3. Write `<name>-api.ts`: transport that fetches and `.parse()`s the response,
   plus the query-key factory and React Query hooks.
4. Build components in `components/`.
5. Export the public surface from `index.ts` — before anything imports it.

## Conventions

- **Files** are `kebab-case.tsx`; **components** are `PascalCase`.
- **Validate at the boundary.** Every API response is parsed by a Zod schema in
  the feature's `api/` layer, so bad data fails with a clear message instead of
  surfacing as `undefined` inside a chart.
- **Server state → React Query. Client state → Zustand.** Never mirror fetched
  data into a store.
- **Colour comes from tokens.** Use `var(--profit)` / `var(--loss)`, never a raw
  hex, so both chart libraries and the DOM stay in sync across themes.
- **Optional props are typed `?: T | undefined`** — required by
  `exactOptionalPropertyTypes` in `tsconfig.app.json`.
