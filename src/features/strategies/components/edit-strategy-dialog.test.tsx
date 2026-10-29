import { beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import { RULE_TEMPLATES } from '../rules';
import type { Strategy } from '../types';

import { EditStrategyDialog } from './edit-strategy-dialog';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
// The code editor has its own tests; here it only has to be the one shown.
vi.mock('./strategy-editor', () => ({ StrategyEditor: () => <div>Code editor</div> }));

beforeAll(() => {
  // jsdom has the element but not the browser's showModal/close methods, and
  // this dialog opens on mount, so they are in place before the first render.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

const STRATEGY = {
  id: 'user-dip-1',
  name: 'My dip',
  description: 'Mine',
} as unknown as Strategy;

function serveSource(rules: unknown) {
  vi.mocked(apiClient.get).mockImplementation((url) =>
    url === '/strategies/user-dip-1/source'
      ? Promise.resolve({
          filename: 'strategy.py',
          source: 'class MyStrategy(BasePortfolio):\n    pass\n',
          body: 'pass',
          indicators: [],
          state: {},
          rules,
        })
      : new Promise(() => undefined),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('opens a builder-made strategy on its rules, with the code one click away', async () => {
  serveSource(RULE_TEMPLATES.find((template) => template.id === 'buy-the-dip')!.rules);
  renderWithProviders(<EditStrategyDialog strategy={STRATEGY} onClose={() => undefined} />);

  expect(await screen.findByText('Buy when the 14-day RSI crosses below 30.')).toBeInTheDocument();
  expect(screen.queryByText('Code editor')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Edit the code instead' }));

  expect(screen.getByText('Code editor')).toBeInTheDocument();
});

it('opens a hand-written strategy in the code editor', async () => {
  serveSource(undefined);
  renderWithProviders(<EditStrategyDialog strategy={STRATEGY} onClose={() => undefined} />);

  expect(await screen.findByText('Code editor')).toBeInTheDocument();
});

it('falls back to the code editor when the saved rules are unreadable', async () => {
  serveSource({ buy: 'everything' });
  renderWithProviders(<EditStrategyDialog strategy={STRATEGY} onClose={() => undefined} />);

  expect(await screen.findByText('Code editor')).toBeInTheDocument();
});
