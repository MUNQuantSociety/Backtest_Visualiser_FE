import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { RunValueAt } from './benchmark-book';
import { RunPointerCard } from './run-pointer-card';

const ROWS: RunValueAt[] = [
  {
    id: 'run-1',
    name: 'Momentum',
    date: '2026-03-14',
    value: 112_430,
    returnSinceStart: 0.124,
    benchmarkReturn: 0.093,
    lead: 0.031,
  },
  {
    id: 'run-2',
    name: 'Late starter',
    date: null,
    value: null,
    returnSinceStart: null,
    benchmarkReturn: null,
    lead: null,
  },
];

function renderCard(props: Partial<Parameters<typeof RunPointerCard>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <RunPointerCard
        date="2026-03-14"
        rows={ROWS}
        benchmarkTitle="SPY"
        colorFor={() => '#fff'}
        pinned={false}
        onClose={onClose}
        {...props}
      />
    </MemoryRouter>,
  );
  return onClose;
}

describe('RunPointerCard', () => {
  it('names the date under the pointer', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: '2026-03-14' })).toBeInTheDocument();
  });

  it('shows each run’s portfolio value, return and lead over the benchmark', () => {
    renderCard();

    const item = screen.getByRole('listitem', { name: 'Momentum' });
    expect(within(item).getByText('$112,430.00')).toBeInTheDocument();
    expect(within(item).getByText('+12.4%')).toBeInTheDocument();
    expect(within(item).getByText('+3.1% vs SPY')).toBeInTheDocument();
  });

  it('links each run to its run page', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Open Momentum' })).toHaveAttribute(
      'href',
      '/backtests/run-1',
    );
  });

  it('shows a dash for a run that had not started by the date', () => {
    renderCard();

    const item = screen.getByRole('listitem', { name: 'Late starter' });
    expect(within(item).getByText('Not started')).toBeInTheDocument();
  });

  it('offers no close button while it follows the pointer', () => {
    renderCard();

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('closes from its button once pinned', async () => {
    const onClose = renderCard({ pinned: true });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
