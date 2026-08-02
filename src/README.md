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

| Feature       | Product             | Owns                                                 |
| ------------- | ------------------- | ---------------------------------------------------- |
| `backtests`   | Backtest Visualiser | Runs, metrics, round-trip trades                     |
| `performance` | both                | Equity curve, drawdown chart, metrics grid           |
| `portfolios`  | MQS Master          | Live sleeves, positions, fills, correlations, config |
| `system`      | MQS Master          | Per-service engine health, log tail                  |

`performance` is the shared one, and it is shared *on purpose*: the live
portfolio page renders its charts unchanged. If you find yourself writing a
second equity chart, stop — the reason both products live in one app is so that
never happens.

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
`@/features/backtests/hooks/use-backtests`. This is enforced by ESLint
(`no-restricted-imports`), not convention, so it cannot rot.

Inside a feature, use relative imports (`../api/query-keys`). Outside, use the
`@/` alias. That contrast makes a boundary violation visible while reading.

## Adding a feature

1. `mkdir -p src/features/<name>/{api,components,hooks,types}`
2. Define Zod schemas in `types/` and infer the TS types from them.
3. Write `api/` functions that fetch and `.parse()` the response.
4. Add a query-key factory and React Query hooks in `hooks/`.
5. Build components in `components/`.
6. Export the public surface from `index.ts`.

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
