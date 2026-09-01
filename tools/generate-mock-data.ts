import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMockBacktests } from '../src/features/backtests/mock-source';

/**
 * Writes the demo dataset to `mock-data/` at the repo root.
 *
 * Run with `npm run generate:mock-data`. Executed through `vite-node` so the
 * `@/` alias resolves exactly as it does in the app — the generator therefore
 * shares `@/utils/metrics` with the running code rather than reimplementing
 * Sharpe and drawdown, which is what stops the dataset's headline numbers from
 * drifting away from what the charts compute.
 *
 * The output is committed. Regenerate only when the shape changes: the point of
 * a checked-in file is that a fresh clone renders charts with no backend and no
 * build step.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, '..', 'mock-data');

async function main(): Promise<void> {
  const backtests = buildMockBacktests();

  await mkdir(outputDir, { recursive: true });

  const file = join(outputDir, 'backtests.json');
  // Pretty-printed: the file is read by humans reviewing diffs far more often
  // than by anything that cares about a few kilobytes.
  await writeFile(file, `${JSON.stringify(backtests, null, 2)}\n`, 'utf8');

  const trades = backtests.reduce((sum, item) => sum + item.trades.length, 0);
  const points = backtests.reduce((sum, item) => sum + item.equityCurve.length, 0);

  console.log(`wrote ${file}`);
  console.log(
    `  ${String(backtests.length)} backtests · ${String(points)} curve points · ${String(trades)} trades`,
  );
}

await main();
