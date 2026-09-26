# Frontend quality and production release gate

Run `npm ci`, then `npx playwright install chromium`, then `npm run ci`.
Use Node 22. On a Linux CI worker, install with `npx playwright install --with-deps chromium`.

`npm run ci` stops on the first failure:

1. ESLint (zero warnings).
2. Deployment-guard tests, including failed/cancelled/missing/stale CI results.
3. The complete Vitest suite, serially to stay within the build worker's memory.
4. TypeScript compilation and Vite production build.
5. Chromium tests against **dist**, served on a dedicated strict port, never the dev server.

## Browser coverage

| Surface | Browser checks | Additional component coverage |
| --- | --- | --- |
| Dashboard | Real chart crosshair, all periods, SPY/buy-and-hold, run switching, visibility, market table, info tooltip, story, watchlist add/remove/reset/persistence, saved-run navigation | API outages/retries, partial history, benchmark/book maths, watchlist, news, indicators |
| Backtests | Search, strategy filter/menu, selected-run comparison, ticker suggestions, isolated run submission, every form-section tooltip and Escape handling | Dates, weights, presets, validation, provider failures, help, strategies, run status, deletion |
| Results | Performance, Risk, Trades, News, Tearsheet, real charts, CSV download | Chart input contracts, trade tables, metric calculations, unavailable metrics, no-trade reports, exports |
| Compare | Direct/reloaded links, 2–4 runs, picker, removal, cap, duplicate IDs, copy link, print request, failed report retry, failed list | Selection ordering, parameter differences, metric winners, benchmark alignment |
| Cross-page | Empty accounts, rejected identity, mobile document width | Authentication, API error handling, shell/navigation |

The browser fixture is test-only. It seeds an isolated browser with a synthetic OIDC session and intercepts API traffic. Unknown/external requests fail the suite (the external font stylesheet is replaced with empty CSS). `VITE_USE_FIXTURES=false`; no production auth bypass is added. Tests never use real user credentials or create/delete production records. Actual canvas chart libraries run, rather than component mocks.

Public API/auth configuration must be present when building and testing locally. GitHub Actions supplies synthetic public values. Run `npm run build` again after changing the configuration; Vite embeds it in the bundle.

## Enforcement and rollout

- `.github/workflows/ci.yml` runs on PRs targeting dev/main and pushes to both branches. No path filters, skipped-test success, `continue-on-error`, or test retries. `Frontend quality gate` is the check to require in branch protection.
- CI pins Ubuntu 24.04 and the reviewed v7 action commit SHAs, so a rolling OS label or moved action tag cannot silently change the pipeline. Update these pins through a tested PR; checkout does not persist credentials.
- `amplify.yml` first checks production API/auth configuration, installs the lockfile, then requires successful **push CI for the exact checkout SHA and branch**. A green PR check or an older deployment is insufficient. It re-runs lint, unit/guard tests, and compilation with the actual Amplify environment before artifacts are published.
- Missing workflow, failed/cancelled/skipped run, invalid SHA, GitHub API error/rate limit, or timeout blocks deployment. A manual Amplify rebuild's `AWS_COMMIT_ID=HEAD` resolves to its checkout SHA and still requires CI for that SHA.
- This gate uses the public repository's read-only GitHub API and no secret. If the repository becomes private, adapt it to authenticated CI verification; do not disable the gate or put a token in `VITE_*`.
- Merge the workflow and Amplify changes together through dev → reviewed PR → main. Require `Frontend quality gate` on main (and dev if desired), with branch up-to-date checks. Keep existing approval requirements; do not bypass reviews.
- For first activation, allow Actions to complete for the pushed commit. Amplify waits up to 20 minutes; if CI is queued longer, the deployment deliberately fails and can be retried once CI passes.
- After merging, verify the exact SHA's Actions result and Amplify BUILD/DEPLOY/VERIFY, then smoke-test the authenticated production routes. A local pass or a merged PR is not proof of a healthy deployed release.

## Limits

This is regression protection, not a promise that production can never fail. Backend availability, Cognito, CORS, user-specific data, and deployment configuration require live checks. The backend already has separate unit, PostgreSQL and image CI, invoked before ECS deployment; this frontend change does not alter backend ownership or deployment. Browser tests are Chromium-focused and do not certify every browser/input combination. Real account creation, production run submission/deletion and publisher navigation are not exercised against live services.

References: [Playwright CI](https://playwright.dev/docs/ci), [production preview server configuration](https://playwright.dev/docs/test-webserver), [Amplify build environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html), [checkout action](https://github.com/actions/checkout), [Node setup action](https://github.com/actions/setup-node), [artifact upload action](https://github.com/actions/upload-artifact).
