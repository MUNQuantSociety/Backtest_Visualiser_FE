import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import { compileRules, RULE_TEMPLATES } from '../rules';

import { RuleBuilder } from './rule-builder';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
  vi.mocked(apiClient.post).mockResolvedValue({
    id: 'user-dip-1',
    name: 'Buy the dip',
    status: 'draft',
    message: 'Validation started.',
    validationRunId: null,
  });
});

it('reads the chosen template back in plain English', async () => {
  renderWithProviders(<RuleBuilder />);

  await userEvent.click(screen.getByRole('button', { name: /Buy the dip/ }));

  expect(screen.getByText('Buy when the 14-day RSI crosses below 30.')).toBeInTheDocument();
  expect(
    screen.getByText('Also sell if a holding falls 10% below what it cost.'),
  ).toBeInTheDocument();
});

it('saves a template as the compiled draft, named after it', async () => {
  renderWithProviders(<RuleBuilder />);
  const dip = RULE_TEMPLATES.find((template) => template.id === 'buy-the-dip')!;

  await userEvent.click(screen.getByRole('button', { name: /Buy the dip/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Save strategy' }));

  expect(apiClient.post).toHaveBeenCalledWith('/strategies/draft', {
    ...compileRules(dip.rules),
    name: 'Buy the dip',
    description: dip.idea,
    // Sent along so the strategy reopens here as rules, not code.
    rules: dip.rules,
  });
});

it('adds a condition and says what is wrong with an impossible one', async () => {
  renderWithProviders(<RuleBuilder />);

  await userEvent.click(screen.getAllByRole('button', { name: 'Add a condition' })[0]!);
  const period = screen.getByRole('spinbutton', { name: 'Buy condition 2, left side, days' });
  await userEvent.clear(period);
  await userEvent.type(period, '1');

  expect(
    screen.getByText('Buy condition 2: a period must be a whole number of days from 2 to 250.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save strategy' })).toBeDisabled();
});

it('asks for a name before saving', async () => {
  renderWithProviders(<RuleBuilder />);

  await userEvent.click(screen.getByRole('button', { name: /Blank/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Save strategy' }));

  expect(screen.getByText('Give the strategy a name.')).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('reopens saved rules and saves an edited copy under a new name', async () => {
  const dip = RULE_TEMPLATES.find((template) => template.id === 'buy-the-dip')!;
  renderWithProviders(
    <RuleBuilder editing={{ name: 'My dip', description: 'Mine', rules: dip.rules }} />,
  );

  expect(screen.getByText('Buy when the 14-day RSI crosses below 30.')).toBeInTheDocument();
  expect(screen.getByDisplayValue('My dip (edited)')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Save strategy' }));

  expect(apiClient.post).toHaveBeenCalledWith(
    '/strategies/draft',
    expect.objectContaining({ name: 'My dip (edited)', rules: dip.rules }),
  );
});
