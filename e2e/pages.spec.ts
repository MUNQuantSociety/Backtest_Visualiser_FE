import { test, expect } from './app-fixture';

test('dashboard: real chart pointer, periods, benchmarks, run and visibility controls', async ({
  page,
}) => {
  await page.goto('/');
  const chart = page.getByRole('img', { name: 'Strategy comparison', exact: true });
  await expect(chart).toBeVisible();
  const box = await chart.boundingBox();
  if (!box) throw new Error('Comparison chart has no layout');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await expect(page.getByRole('region', { name: 'Run values' })).toBeVisible();
  for (const name of ['2Y', '5Y', 'Max', '1Y']) {
    await page.getByRole('radio', { name, exact: true }).click();
    await expect(page.getByRole('radio', { name, exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  }
  await page.getByRole('radio', { name: 'Buy & hold', exact: true }).click();
  await expect(page.getByRole('heading', { name: /strategies vs. Buy & hold/ })).toBeVisible();
  await page.getByRole('radio', { name: 'SPY', exact: true }).click();
  const visibility = page.getByRole('checkbox', { name: 'Show Momentum on comparison chart' });
  await visibility.uncheck();
  await expect(visibility).not.toBeChecked();
  await page.getByRole('combobox', { name: 'Run shown for Momentum' }).selectOption('run-2');
  await expect(page.getByRole('table', { name: 'Run alpha metrics' })).toContainText('Beta run');
  await expect(visibility).not.toBeChecked();
  await visibility.check();
  await expect(chart).toBeVisible();
});

test('dashboard: market table, tooltip, story and saved-run navigation', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('table', { name: 'Indicators and sentiment by ticker' }),
  ).toContainText('AAPL');
  await page.getByRole('button', { name: 'About RSI 14', exact: true }).click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open story: Test market story' }).click();
  await expect(page.getByText('A test news summary.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'View all backtests →' }).click();
  await expect(page.getByRole('heading', { name: 'Backtests', exact: true })).toBeVisible();
});

test('backtests: search, strategy selection, menus and comparison selection', async ({ page }) => {
  await page.goto('/backtests');
  await expect(page.getByRole('link', { name: 'Alpha run', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search strategies and runs' });
  await search.fill('Alpha');
  await expect(page.getByRole('link', { name: 'Beta run', exact: true })).toHaveCount(0);
  await search.fill('');
  await page.getByRole('option', { name: /^Momentum / }).click();
  await expect(page.getByRole('link', { name: 'Gamma run', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Actions for Momentum' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /All runs/ }).click();
  // The visible checkbox is the input's wrapping label; also prove keyboard access.
  await page.getByRole('checkbox', { name: /Select Alpha run/ }).press('Space');
  await expect(page.getByRole('checkbox', { name: /Select Alpha run/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /Select Beta run/ }).press('Space');
  await page.getByRole('button', { name: /Compare/ }).click();
  await expect(page.getByRole('heading', { name: 'Compare 2 runs', exact: true })).toBeVisible();
});

test('backtests: run form, ticker suggestions and isolated submission', async ({
  page,
  apiState,
}) => {
  await page.goto('/backtests');
  await page.getByRole('button', { name: 'Run backtest', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Run backtest', exact: true });
  await expect(dialog).toBeVisible();
  await page.getByLabel('Run name', { exact: true }).fill('CI test run');
  await page.getByLabel('Strategy', { exact: true }).selectOption('momentum');
  const ticker = page.getByRole('combobox', { name: /Add ticker/ });
  await ticker.fill('MS');
  await expect(page.getByRole('option', { name: /MSFT/ })).toBeVisible();
  await ticker.press('Escape');
  await ticker.fill('');
  await expect(dialog.getByRole('button', { name: /Run backtest/ })).toBeEnabled();
  await dialog.getByRole('button', { name: /Run backtest/ }).click();
  await expect(page).toHaveURL(/\/backtests\/run-1/);
  expect(apiState.writes).toContainEqual(
    expect.objectContaining({
      method: 'POST',
      path: '/backtests',
      body: expect.objectContaining({ name: 'CI test run', strategyKey: 'momentum' }),
    }),
  );
});

test('backtest results: every analysis tab, real charts and CSV export', async ({ page }) => {
  await page.goto('/backtests/run-1');
  await expect(page.getByRole('heading', { name: 'Backtest results' })).toBeVisible();
  for (const [name, heading] of [
    ['Risk', 'Rolling volatility (63d)'],
    ['Trades', 'Trade ledger'],
    ['News', 'News during this run'],
    ['Tearsheet', 'Performance summary'],
    ['Performance', 'Monthly returns'],
  ]) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page).toHaveURL(new RegExp(`tab=${name.toLowerCase()}`));
    await expect(page.locator('main')).not.toContainText('NaN');
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Equity', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toContain('equity.csv');
});

test('compare: direct link, all panels, adding/removing runs and four-run cap', async ({
  page,
}) => {
  await page.goto('/compare?runs=run-1,run-2');
  await expect(page.getByRole('heading', { name: 'Compare 2 runs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Monthly return/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Strategy comparison', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add run', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add a run' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search runs' }).fill('Gamma');
  await page.getByRole('button', { name: /^Gamma run/ }).click();
  await expect(page.getByRole('heading', { name: 'Compare 3 runs' })).toBeVisible();
  await page.getByRole('button', { name: 'Add run', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search runs' }).fill('Delta');
  await page.getByRole('button', { name: /^Delta run/ }).click();
  await expect(page.getByRole('button', { name: 'Add run', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove run D' }).click();
  await expect(page.getByRole('heading', { name: 'Compare 3 runs' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Compare 3 runs' })).toBeVisible();
});

test('compare: duplicate URL IDs are treated as one run', async ({ page }) => {
  await page.goto('/compare?runs=run-1,run-1');
  await expect(page.getByRole('heading', { name: 'Compare 1 run', exact: true })).toBeVisible();
  await expect(page.getByText('One more to compare', { exact: true })).toBeVisible();
});

test('compare: copy link and print actions work on the built page', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });
  await page.goto('/compare?runs=run-1,run-2');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('runs=run-1,run-2');
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
});

test('dashboard: watchlist additions persist, can be removed and reset', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Add ticker to watchlist' }).fill('MSFT');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open MSFT', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open MSFT', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove MSFT from watchlist' }).click();
  await expect(page.getByRole('link', { name: 'Open MSFT', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open AAPL', exact: true })).toBeVisible();
});

test('backtests: each form tooltip stays inside the modal and Escape closes only the tooltip', async ({
  page,
}) => {
  await page.goto('/backtests');
  await page.getByRole('button', { name: 'Run backtest', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Run backtest', exact: true });
  for (const label of [
    'Strategy',
    'Universe',
    'Weights',
    'Window',
    'Bar timestep',
    'Capital & costs',
    'Indicators',
    'Run name',
  ]) {
    const trigger = dialog.getByRole('button', { name: `About ${label}`, exact: true });
    await trigger.click();
    await expect(dialog.getByRole('tooltip')).toBeVisible();
    await trigger.press('Escape');
    await expect(dialog.getByRole('tooltip')).toHaveCount(0);
    await expect(dialog).toBeVisible();
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('compare: failed report has an explicit retry, not an endless skeleton', async ({
  page,
  apiState,
}) => {
  apiState.failures.set('/backtests/run-2', 404);
  await page.goto('/compare?runs=run-1,run-2');
  await expect(page.getByText('Could not load all selected runs', { exact: true })).toBeVisible();
  apiState.failures.clear();
  await page.getByRole('button', { name: 'Retry comparison' }).click();
  await expect(page.getByRole('img', { name: 'Strategy comparison', exact: true })).toBeVisible();
});

test('compare: list outage is not misreported as empty history', async ({ page, apiState }) => {
  apiState.failures.set('/backtests', 403);
  await page.goto('/compare');
  await expect(page.getByText('Could not load saved runs', { exact: true })).toBeVisible();
});

test('empty states across dashboard, backtests and compare', async ({ page, apiState }) => {
  apiState.empty = true;
  for (const path of ['/', '/backtests', '/compare']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('NaN');
  }
  await expect(page.getByText('Nothing to compare yet', { exact: true })).toBeVisible();
});

test('rejected identity cannot render authenticated pages', async ({ page, apiState }) => {
  apiState.failures.set('/auth/me', 403);
  await page.goto('/backtests');
  await expect(page.getByRole('button', { name: 'Continue to secure sign-in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alpha run', exact: true })).toHaveCount(0);
});

test('mobile: all three pages remain usable without a page-wide horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/backtests', '/compare?runs=run-1,run-2']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Check the populated layout, not just its narrower loading skeleton.
    if (path === '/backtests') {
      await expect(page.getByRole('link', { name: 'Alpha run', exact: true })).toBeVisible();
    } else {
      await expect(
        page.getByRole('img', { name: 'Strategy comparison', exact: true }),
      ).toBeVisible();
    }
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      overflowing: Array.from(document.querySelectorAll('main *'))
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          right: element.getBoundingClientRect().right,
        }))
        .filter((element) => element.right > window.innerWidth)
        .slice(0, 30),
    }));
    expect(layout.width, JSON.stringify({ path, ...layout })).toBeLessThanOrEqual(
      layout.viewport + 1,
    );
  }
});
