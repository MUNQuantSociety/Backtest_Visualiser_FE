import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { RunsTable } from './runs-table';
import type { BacktestSummary } from './types';

function run(id: string, status: BacktestSummary['status']): BacktestSummary {
  return {
    id,
    name: `Run ${id}`,
    strategyId: 'strategy-1',
    strategyName: 'Momentum',
    symbol: 'AAPL',
    timeframe: '1d',
    status,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    createdAt: '2026-01-01T00:00:00Z',
    initialCapital: 100_000,
    finalEquity: 100_000,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
  };
}

function renderTable(runs: BacktestSummary[], onToggle = vi.fn()) {
  render(
    <MemoryRouter>
      <RunsTable runs={runs} isLoading={false} selectedIds={[]} onToggle={onToggle} />
    </MemoryRouter>,
  );
  return onToggle;
}

describe('RunsTable', () => {
  it('shows a run still in flight with its status', () => {
    renderTable([run('1', 'queued')]);

    expect(screen.getByText('queued')).toBeInTheDocument();
  });

  it('does not let a run in flight be selected for compare or delete', async () => {
    const onToggle = renderTable([run('1', 'running')]);

    const checkbox = screen.getByRole('checkbox', { name: 'Select Run 1' });
    await userEvent.click(checkbox);

    expect(checkbox).toBeDisabled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('lets a completed run be selected', async () => {
    const onToggle = renderTable([run('1', 'completed')]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Run 1' }));

    expect(onToggle).toHaveBeenCalledWith('1');
  });
});
