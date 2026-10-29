import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import FinancialCalculatorPage from './financial-calculator-page';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn() },
}));

const CURVE = {
  date: '2026-10-28',
  yields: [
    { term: '3M', years: 0.25, ratePercent: 4.18 },
    { term: '3Y', years: 3, ratePercent: 4.8 },
    { term: '5Y', years: 5, ratePercent: 4.85 },
    { term: '10Y', years: 10, ratePercent: 5.05 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue(CURVE);
});

it('shows a worked answer in every card from the start', () => {
  renderWithProviders(<FinancialCalculatorPage />);

  expect(screen.getByRole('status', { name: 'Future value result' })).toHaveTextContent(
    '$1,628.89',
  );
  expect(screen.getByRole('status', { name: 'Present value result' })).toHaveTextContent('$613.91');
  expect(screen.getByRole('status', { name: 'Net present value (NPV) result' })).toHaveTextContent(
    'Worth doing at 10%: the cash flows are worth $227.65 more than the investment.',
  );
  expect(
    screen.getByRole('status', { name: 'Present value of an annuity result' }),
  ).toHaveTextContent(
    '$500.00 paid every month for 5 years is worth $25,862.78 today at 6% a year.',
  );
});

it('recalculates as the reader types', async () => {
  renderWithProviders(<FinancialCalculatorPage />);
  const card = screen.getByRole('status', { name: 'Future value result' });
  const years = screen.getAllByRole('spinbutton', { name: 'Years' })[0]!;

  await userEvent.clear(years);
  await userEvent.type(years, '20');

  expect(card).toHaveTextContent('$2,653.30');
  expect(card).toHaveTextContent('grows to $2,653.30 in 20 years.');
});

it('explains an input with no answer instead of showing a number', async () => {
  renderWithProviders(<FinancialCalculatorPage />);
  const flows = screen.getByRole('textbox', { name: 'Cash flows, one per year ($)' });

  await userEvent.clear(flows);
  await userEvent.type(flows, '400, lots');

  expect(screen.getByRole('status', { name: 'Net present value (NPV) result' })).toHaveTextContent(
    'Every cash flow must be a number.',
  );
});

it('marks a project that loses money', async () => {
  renderWithProviders(<FinancialCalculatorPage />);
  const flows = screen.getByRole('textbox', { name: 'Cash flows, one per year ($)' });

  await userEvent.clear(flows);
  await userEvent.type(flows, '300, 400, 500');

  expect(screen.getByRole('status', { name: 'Net present value (NPV) result' })).toHaveTextContent(
    'Not worth it at 10%: the cash flows fall $21.04 short of the investment.',
  );
});

it('handles a monthly annuity at 0%', async () => {
  renderWithProviders(<FinancialCalculatorPage />);
  const rate = screen.getAllByRole('spinbutton', { name: 'Interest rate (%/yr)' })[1]!;

  await userEvent.clear(rate);
  await userEvent.type(rate, '0');

  expect(
    screen.getByRole('status', { name: 'Present value of an annuity result' }),
  ).toHaveTextContent('$30,000.00');
});

it('offers the Treasury yield closest to each horizon, and uses it on a click', async () => {
  renderWithProviders(<FinancialCalculatorPage />);

  // Future value over 10 years, and NPV over three yearly cash flows.
  const tenYear = await screen.findAllByRole('button', {
    name: 'Use the 10-year Treasury yield, 5.05%',
  });
  expect(
    screen.getByRole('button', { name: 'Use the 3-year Treasury yield, 4.8%' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Use the 5-year Treasury yield, 4.85%' }),
  ).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(1);

  await userEvent.click(tenYear[0]!);

  expect(screen.getByRole('status', { name: 'Future value result' })).toHaveTextContent(
    'at 5.05% a year grows to',
  );
});

it('stays a plain calculator when the Treasury rates cannot be fetched', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
  renderWithProviders(<FinancialCalculatorPage />);

  await vi.waitFor(() => {
    expect(apiClient.get).toHaveBeenCalled();
  });
  expect(screen.queryByRole('button', { name: /Treasury/ })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Future value result' })).toHaveTextContent(
    '$1,628.89',
  );
});
