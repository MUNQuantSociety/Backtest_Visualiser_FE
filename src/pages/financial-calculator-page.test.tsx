import { expect, it } from 'vitest';

import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import FinancialCalculatorPage from './financial-calculator-page';

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
  const rate = screen.getAllByRole('spinbutton', { name: 'Interest rate (% a year)' })[1]!;

  await userEvent.clear(rate);
  await userEvent.type(rate, '0');

  expect(
    screen.getByRole('status', { name: 'Present value of an annuity result' }),
  ).toHaveTextContent('$30,000.00');
});
